#!/usr/bin/env python3
"""Convert the approved Phase 2 deliverables into normalized JSON under data/.

    python3 scripts/convert_xlsx.py docs/deliverables

Reads the four signed-off files:

    Data Files/salaries_data.xlsx        salary bands + sources + confidence
    Data Files/Universities_majors.xlsx  6 universities, Tawjihi admission averages
    Data Files/companies_jobs.xlsx       176 listings + fresh-grad benchmarks
    Engineering Courses/All Courses.xlsx courses, career paths, providers

Runtime never touches .xlsx — the seed script reads data/*.json. Re-run this
only when the team ships updated spreadsheets. Stdlib only, no pip install.

This data is approved and verified, so figures are carried through rather than
suppressed. What is *not* carried through is anything the files do not say:
unparseable values keep their original string in a *_raw field and are listed
under "warnings" at the end.
"""
import html
import json
import os
import re
import sys
import zipfile
from pathlib import Path

WARNINGS = []


def warn(message):
    """Record a warning once, however many rows trigger it."""
    if message not in WARNINGS:
        WARNINGS.append(message)


# --------------------------------------------------------------- xlsx reader --
def _col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path):
    """-> [(sheet_name, [[cell, ...], ...]), ...]"""
    z = zipfile.ZipFile(path)

    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = z.read("xl/sharedStrings.xml").decode("utf8")
        for si in re.findall(r"<si>(.*?)</si>", ss, re.S):
            shared.append("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)))

    wb = z.read("xl/workbook.xml").decode("utf8")
    # <sheet> can carry other attributes (xmlns:r) before name=
    names = [html.unescape(n) for n in re.findall(r'<sheet\b[^>]*?\sname="([^"]+)"', wb)]
    paths = sorted(
        (n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)),
        key=lambda s: int(re.search(r"(\d+)", s).group(1)),
    )

    sheets = []
    for name, p in zip(names, paths):
        xml = z.read(p).decode("utf8")
        rows = []
        for row_xml in re.findall(r"<row[^>]*>(.*?)</row>", xml, re.S):
            cells = {}
            for chunk in re.split(r"(?=<c[ /])", row_xml):
                if not chunk.startswith("<c"):
                    continue
                ref = re.search(r'r="([A-Z]+\d+)"', chunk)
                if not ref:
                    continue
                kind = re.search(r't="(\w+)"', chunk)
                kind = kind.group(1) if kind else "n"
                if kind == "s":
                    v = re.search(r"<v>(\d+)</v>", chunk)
                    val = shared[int(v.group(1))] if v else ""
                elif kind == "inlineStr":
                    val = "".join(re.findall(r"<t[^>]*>(.*?)</t>", chunk, re.S))
                else:
                    v = re.search(r"<v>(.*?)</v>", chunk, re.S)
                    val = v.group(1) if v else ""
                cells[_col(ref.group(1))] = html.unescape(val).strip()
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        sheets.append((name, rows))
    return sheets


def cell(row, i):
    return row[i].strip() if i < len(row) else ""


def is_blank(row):
    return not any(c.strip() for c in row)


def lines(text):
    """Split a multi-line cell into clean lines."""
    return [l.strip() for l in re.split(r"[\r\n]+", text or "") if l.strip()]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ------------------------------------------------------------------- majors --
# One canonical name per major. Everything else in the workbooks is an alias:
# the universities file uses short forms ("Computer", "CS", "Medical") and the
# course workbook uses sheet prefixes.
MAJORS = {
    "Electrical Engineering": ["electrical", "electrical / power", "electrical / computer", "ee"],
    "Computer Engineering": ["computer", "computer engineering", "ce"],
    "Computer Science": ["cs", "computer science"],
    "Software Engineering": ["software", "software engineering", "se"],
    "Civil Engineering": ["civil", "civil / construction", "civil /geomatics", "civil / geomatics"],
    "Mechanical Engineering": ["mechanical", "mechanical engineering"],
    "Mechatronics Engineering": ["mechatronics", "mechatronics engineering"],
    "Chemical Engineering": ["chemical", "chemical engineering"],
    "Biomedical Engineering": ["biomedical", "biomedical engineering", "medical"],
    "Semiconductor Engineering": ["semi conductors", "semiconductors", "semiconductor"],
}
ALIAS_TO_MAJOR = {a: canon for canon, aliases in MAJORS.items() for a in aliases}
ALIAS_TO_MAJOR.update({canon.lower(): canon for canon in MAJORS})


def canonical_major(raw):
    if not raw:
        return None
    key = re.sub(r"\s+", " ", raw.strip().lower())
    return ALIAS_TO_MAJOR.get(key)


MONEY_RANGE = re.compile(r"(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)")
MONEY_ONE = re.compile(r"(\d[\d,]*)")


def parse_monthly(raw, *, context):
    """'400–450 /mo (4,800–5,400 /yr)' -> (400, 450).

    Only the part before the annualised parenthetical is considered, so the
    yearly figure can never be mistaken for the monthly one.
    """
    if not raw:
        return None, None, None
    monthly = raw.split("(")[0]
    m = MONEY_RANGE.search(monthly)
    if m:
        lo, hi = (int(g.replace(",", "")) for g in m.groups())
        if lo > hi:
            warn(f"low > high in {raw!r} ({context})")
            return None, None, raw
        return lo, hi, raw
    one = MONEY_ONE.search(monthly)
    if one:
        v = int(one.group(1).replace(",", ""))
        return v, v, raw
    return None, None, raw


CONFIDENCE_RANK = [
    ("medium-high", "high"),
    ("low-medium", "low"),
    ("high", "high"),
    ("medium", "medium"),
    ("low", "low"),
]


def confidence_to_quality(text):
    """The sheet grades its own figures; carry that grade into data_quality."""
    t = (text or "").strip().lower()
    for prefix, quality in CONFIDENCE_RANK:
        if t.startswith(prefix):
            return quality
    return "pending"


def convert_salaries(src):
    path = src / "Data Files" / "salaries_data.xlsx"
    if not path.exists():
        warn("missing salaries_data.xlsx — majors will carry no salary bands")
        return {}, []

    sheets = dict(read_xlsx(path))
    majors = {}

    rows = sheets.get("Salary Data", [])
    header_at = next(
        (i for i, r in enumerate(rows) if cell(r, 0).lower() == "major"), None
    )
    if header_at is None:
        warn("salaries_data.xlsx: no 'Major' header row found")
        return {}, []

    for row in rows[header_at + 1:]:
        if is_blank(row):
            continue
        name = canonical_major(cell(row, 0))
        if not name:
            warn(f"salary row for unmapped major {cell(row, 0)!r} — skipped")
            continue
        entry_lo, entry_hi, entry_raw = parse_monthly(cell(row, 1), context=f"{name} entry")
        y3_lo, y3_hi, y3_raw = parse_monthly(cell(row, 2), context=f"{name} 3-yr")
        y5_lo, y5_hi, y5_raw = parse_monthly(cell(row, 3), context=f"{name} 5-yr")
        confidence = cell(row, 6)
        majors[name] = {
            "salary_entry_min_jod": entry_lo,
            "salary_entry_max_jod": entry_hi,
            "salary_entry_raw": entry_raw,
            "salary_3yr_min_jod": y3_lo,
            "salary_3yr_max_jod": y3_hi,
            "salary_3yr_raw": y3_raw,
            "salary_5yr_min_jod": y5_lo,
            "salary_5yr_max_jod": y5_hi,
            "salary_5yr_raw": y5_raw,
            "top_jobs": lines(cell(row, 4)),
            "salary_source": cell(row, 5),
            "salary_confidence": confidence,
            "data_quality": confidence_to_quality(confidence),
        }

    # References tab: the numbered [R1]…[Rn] citations the salary cells point at.
    references = []
    ref_rows = sheets.get("References", [])
    ref_header = next((i for i, r in enumerate(ref_rows) if cell(r, 0).upper() == "ID"), None)
    if ref_header is not None:
        for row in ref_rows[ref_header + 1:]:
            if is_blank(row) or not cell(row, 0):
                continue
            references.append(
                {
                    "id": cell(row, 0),
                    "source": cell(row, 1),
                    "role": cell(row, 2),
                    "provided": cell(row, 3),
                    "link": cell(row, 4),
                }
            )
    return majors, references


# ------------------------------------------------------------- universities --
def parse_years(raw):
    m = re.search(r"(\d+)", raw or "")
    return int(m.group(1)) if m else None


def parse_average(raw):
    """Tawjihi averages are percentages; 'N/A' means the file has no figure."""
    if not raw or raw.strip().upper() in {"N/A", "NA", "-", "—"}:
        return None
    m = re.search(r"\d+(?:\.\d+)?", raw)
    return float(m.group(0)) if m else None


def convert_universities(src):
    path = src / "Data Files" / "Universities_majors.xlsx"
    if not path.exists():
        warn("missing Universities_majors.xlsx")
        return [], []

    rows = read_xlsx(path)[0][1]
    universities, links = {}, []

    for row in rows[1:]:
        if is_blank(row) or not cell(row, 0):
            continue
        raw_uni = cell(row, 0)
        code_match = re.search(r"\(([A-Z]{2,6})\)", raw_uni)
        if not code_match:
            warn(f"university without a (CODE): {raw_uni!r} — skipped")
            continue
        code = code_match.group(1)
        name = raw_uni[: code_match.start()].strip()
        # The source file spells it "Jodan"; the institution is Jordan UST.
        if name.lower().startswith("jodan"):
            name = "Jordan" + name[5:]
            if code == "JUST":
                warn(
                    "Universities_majors.xlsx spells JUST as 'Jodan University…'; "
                    "corrected to 'Jordan' for display, source value preserved"
                )

        entry = universities.setdefault(
            code,
            {
                "code": code,
                "name": name,
                "name_in_source": raw_uni,
                "city": None,
                "website": None,
                "source_files": ["Universities_majors.xlsx"],
                "programs_note": None,
            },
        )

        program = cell(row, 1)
        major = canonical_major(program)
        if not major:
            warn(f"{code}: program {program!r} maps to no canonical major — skipped")
            continue

        links.append(
            {
                "university_code": code,
                "major_name": major,
                "program_name": program,
                "faculty": cell(row, 2),
                "duration_years": parse_years(cell(row, 3)),
                "parallel_average": parse_average(cell(row, 4)),
                "competitive_average": parse_average(cell(row, 5)),
                "minimum_average": parse_average(cell(row, 6)),
                "relation": "offers_degree",  # this file lists degree programmes
                "evidence": f"Universities_majors.xlsx · {raw_uni} · {program}",
            }
        )

    for u in sorted(universities.values(), key=lambda u: u["code"]):
        n = sum(1 for l in links if l["university_code"] == u["code"])
        print(f"  {u['code']:<5} {u['name'][:44]:<44} {n} programmes")

    return sorted(universities.values(), key=lambda u: u["code"]), links


# --------------------------------------------------------------------- jobs --
def convert_jobs(src):
    path = src / "Data Files" / "companies_jobs.xlsx"
    if not path.exists():
        warn("missing companies_jobs.xlsx")
        return [], []

    sheets = dict(read_xlsx(path))
    jobs, seen = [], set()

    for row in sheets.get("Jobs", [])[1:]:
        if is_blank(row):
            continue
        company, title = cell(row, 0), cell(row, 1)
        if not company or not title:
            continue
        key = (company.lower(), title.lower())
        if key in seen:
            continue
        seen.add(key)

        salary_raw = cell(row, 4)
        lo, hi, _ = parse_monthly(salary_raw, context=f"{company}/{title[:30]}")
        gpa_raw = cell(row, 3)

        # Map free-text majors onto canonical ones where possible, but keep the
        # original list too — employers write "Telecom Engineering" and similar
        # that have no canonical equivalent, and dropping them would lose signal.
        raw_majors = [p.strip() for p in re.split(r"[/,;]", cell(row, 2)) if p.strip()]
        canon = sorted({canonical_major(m) for m in raw_majors} - {None})

        jobs.append(
            {
                "company_name": company,
                "title": title,
                "required_majors": raw_majors,
                "canonical_majors": canon,
                "min_gpa": None if gpa_raw.lower().startswith("not") else None,
                "min_gpa_raw": gpa_raw,
                "salary_raw": salary_raw,
                "salary_min_jod": lo,
                "salary_max_jod": hi,
                "salary_is_estimate": salary_raw.lower().startswith("est"),
                "required_skills": [s.strip() for s in re.split(r"[,;]", cell(row, 5)) if s.strip()],
                "source": cell(row, 6),
                "verified": True,  # every row in the approved file is signed off
            }
        )

    benchmarks = []
    for row in sheets.get("Fresh_Grad_Salary_Benchmarks", [])[1:]:
        if is_blank(row) or not cell(row, 0):
            continue
        lo, hi, _ = parse_monthly(cell(row, 1), context=f"benchmark {cell(row, 0)}")
        if lo is None:
            # Footnote rows ("Note: No individual job ad…") carry no range.
            continue
        benchmarks.append(
            {
                "role_family": cell(row, 0),
                "range_raw": cell(row, 1),
                "min_jod": lo,
                "max_jod": hi,
                "source": cell(row, 2),
            }
        )
    return jobs, benchmarks


# ------------------------------------------------------------------ courses --
# All Courses.xlsx carries several unrelated table shapes. Each handler below
# reads one shape; SHEET_ROUTES decides which handler a sheet goes to.
STD_COURSE_HEADER = "sub-field / track"
DETAIL_HEADER = "career path"


def std_courses(rows, major, sheet):
    """6-col: Sub-Field | Course | Provider | Accreditation | Cost | Notes"""
    out, section = [], ""
    for row in rows[1:]:
        if is_blank(row):
            continue
        if cell(row, 0) and not any(cell(row, i) for i in range(1, 6)):
            section = cell(row, 0)
            continue
        name = cell(row, 1)
        if not name:
            continue
        lo, hi, raw = parse_monthly(cell(row, 4), context=f"{sheet}:{name[:36]}")
        out.append(
            {
                "major_name": major,
                "track": re.sub(r"^\s*\d+\s*[.)]\s*", "", cell(row, 0) or section),
                "name": name,
                "what_you_learn": None,
                "provider": cell(row, 2),
                "accreditation": cell(row, 3),
                "online_alternative": None,
                "duration": None,
                "cost_raw": raw,
                "cost_min_jod": lo,
                "cost_max_jod": hi,
                "cost_online_usd": None,
                "notes": cell(row, 5),
                "source_sheet": sheet,
            }
        )
    return out


def detail_courses(rows, major, sheet):
    """9-col: Career Path | Course | What You Learn | Where in Jordan |
    Online Alternative | Duration | Cost in Jordan | Online Cost | Notes"""
    out, track = [], ""
    for row in rows[1:]:
        if is_blank(row):
            continue
        if cell(row, 0):
            track = cell(row, 0)
        name = cell(row, 1)
        if not name:
            continue
        lo, hi, raw = parse_monthly(cell(row, 6), context=f"{sheet}:{name[:36]}")
        out.append(
            {
                "major_name": major,
                "track": track,
                "name": name,
                "what_you_learn": cell(row, 2) or None,
                "provider": cell(row, 3) or None,
                "accreditation": None,
                "online_alternative": cell(row, 4) or None,
                "duration": cell(row, 5) or None,
                "cost_raw": raw,
                "cost_min_jod": lo,
                "cost_max_jod": hi,
                "cost_online_usd": cell(row, 7) or None,
                "notes": cell(row, 8) or None,
                "source_sheet": sheet,
            }
        )
    return out


def career_path_rows(rows, major, sheet):
    """5-col: # | Career Path | Focus | Typical Roles | Tools"""
    out = []
    for row in rows[1:]:
        if is_blank(row) or not cell(row, 1):
            continue
        out.append(
            {
                "major_name": major,
                "name": cell(row, 1),
                "focus": cell(row, 2),
                "typical_roles": cell(row, 3),
                "tools": cell(row, 4),
                "skills": None,
                "coursera": None,
                "udemy": None,
                "jordan_centers": None,
                "source_sheet": sheet,
            }
        )
    return out


def skills_path_rows(rows, major, sheet):
    """5-col: Career Path/Job Title | Skills | Coursera | Udemy | Centers"""
    out = []
    for row in rows[1:]:
        if is_blank(row) or not cell(row, 0):
            continue
        out.append(
            {
                "major_name": major,
                "name": cell(row, 0),
                "focus": None,
                "typical_roles": None,
                "tools": None,
                "skills": cell(row, 1),
                "coursera": cell(row, 2),
                "udemy": cell(row, 3),
                "jordan_centers": cell(row, 4),
                "source_sheet": sheet,
            }
        )
    return out


def centre_rows(rows, sheet, cols):
    """Training centres, in whichever column order the sheet uses."""
    out = []
    for row in rows[1:]:
        if is_blank(row) or not cell(row, cols["name"]):
            continue
        out.append(
            {
                "name": cell(row, cols["name"]),
                "field": cell(row, cols["field"]) if cols.get("field") is not None else None,
                "location": cell(row, cols["location"]) if cols.get("location") is not None else None,
                "specialty": cell(row, cols["specialty"]) if cols.get("specialty") is not None else None,
                "notes": cell(row, cols["notes"]) if cols.get("notes") is not None else None,
                "website": cell(row, cols["website"]) if cols.get("website") is not None else None,
                "source_sheet": sheet,
            }
        )
    return out


def platform_rows(rows, sheet):
    out = []
    for row in rows[1:]:
        if is_blank(row) or not cell(row, 0):
            continue
        out.append(
            {
                "name": cell(row, 0),
                "best_for": cell(row, 1),
                "pricing": cell(row, 2),
                "notes": cell(row, 3),
                "source_sheet": sheet,
            }
        )
    return out


SHEET_MAJOR_PREFIX = {"CE": "Civil Engineering", "CS": "Computer Science"}


def convert_courses(src):
    path = src / "Engineering Courses" / "All Courses.xlsx"
    if not path.exists():
        warn("missing All Courses.xlsx")
        return [], [], [], []

    courses, paths_out, centres, platforms = [], [], [], []

    for sheet, rows in read_xlsx(path):
        if not rows:
            continue
        header = [c.lower() for c in rows[0]]
        first = header[0] if header else ""
        prefix = sheet.split(" - ")[0].strip()
        major = SHEET_MAJOR_PREFIX.get(prefix) or canonical_major(sheet) or canonical_major(prefix)

        if "read me" in sheet.lower() or sheet.lower() == "cover":
            continue

        if first.startswith(STD_COURSE_HEADER):
            if not major and sheet.lower() != "shared courses":
                warn(f"course sheet {sheet!r} maps to no major — rows kept unlinked")
            courses += std_courses(rows, major, sheet)
        elif "courses & training detail" in sheet.lower():
            courses += detail_courses(rows, major, sheet)
        elif "career paths overview" in sheet.lower():
            paths_out += career_path_rows(rows, major, sheet)
        elif first.startswith(DETAIL_HEADER) or first.startswith("job title"):
            paths_out += skills_path_rows(rows, major, sheet)
        elif first.startswith("centre") or first.startswith("center"):
            centres += centre_rows(
                rows, sheet,
                {"name": 0, "location": 1, "specialty": 2, "notes": 3, "website": 4},
            )
        elif first.startswith("provider"):
            centres += centre_rows(
                rows, sheet,
                {"name": 0, "location": 1, "specialty": 2, "notes": 4, "field": 2, "website": None},
            )
        elif first.startswith("field"):
            centres += centre_rows(
                rows, sheet,
                {"field": 0, "name": 1, "specialty": 2, "notes": 3, "location": 4, "website": None},
            )
        elif first.startswith("platform"):
            platforms += platform_rows(rows, sheet)
        else:
            warn(f"unrecognised sheet layout: {sheet!r} (header {rows[0][:3]}) — skipped")

    return courses, paths_out, centres, platforms


# --------------------------------------------------------------------- main --
def build_majors(salary_by_major, university_links, courses, jobs):
    """The canonical major list, enriched from every file that mentions it."""
    names = set(MAJORS)
    out = []
    for name in sorted(names):
        salary = salary_by_major.get(name, {})
        out.append(
            {
                "slug": slugify(name),
                "name": name,
                "faculty": next(
                    (l["faculty"] for l in university_links if l["major_name"] == name and l["faculty"]),
                    "Engineering",
                ),
                "duration_years": next(
                    (l["duration_years"] for l in university_links
                     if l["major_name"] == name and l["duration_years"]),
                    None,
                ),
                "entry_requirements": None,
                "top_jobs": salary.get("top_jobs", []),
                "salary_entry_min_jod": salary.get("salary_entry_min_jod"),
                "salary_entry_max_jod": salary.get("salary_entry_max_jod"),
                "salary_entry_raw": salary.get("salary_entry_raw"),
                "salary_3yr_min_jod": salary.get("salary_3yr_min_jod"),
                "salary_3yr_max_jod": salary.get("salary_3yr_max_jod"),
                "salary_3yr_raw": salary.get("salary_3yr_raw"),
                "salary_5yr_min_jod": salary.get("salary_5yr_min_jod"),
                "salary_5yr_max_jod": salary.get("salary_5yr_max_jod"),
                "salary_5yr_raw": salary.get("salary_5yr_raw"),
                "salary_source": salary.get("salary_source"),
                "salary_confidence": salary.get("salary_confidence"),
                "data_quality": salary.get("data_quality", "pending"),
            }
        )
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(f"usage: {sys.argv[0]} <deliverables-dir>")
    src = Path(sys.argv[1]).expanduser()
    if not src.is_dir():
        sys.exit(f"not a directory: {src}")

    out = Path(__file__).resolve().parent.parent / "data"
    out.mkdir(exist_ok=True)

    print(f"reading approved deliverables from {src}\n")

    print("salaries:")
    salary_by_major, references = convert_salaries(src)
    print(f"  {len(salary_by_major)} majors with bands, {len(references)} cited references")

    print("universities:")
    universities, university_majors = convert_universities(src)

    print("jobs:")
    jobs, benchmarks = convert_jobs(src)
    print(f"  {len(jobs)} listings, {len(benchmarks)} fresh-grad benchmarks")

    print("courses:")
    courses, career_paths, training_centers, online_platforms = convert_courses(src)
    print(
        f"  {len(courses)} courses, {len(career_paths)} career paths, "
        f"{len(training_centers)} centres, {len(online_platforms)} platforms"
    )

    majors = build_majors(salary_by_major, university_majors, courses, jobs)

    datasets = {
        "majors.json": majors,
        "universities.json": universities,
        "university_majors.json": university_majors,
        "courses.json": courses,
        "career_paths.json": career_paths,
        "training_centers.json": training_centers,
        "online_platforms.json": online_platforms,
        "jobs.json": jobs,
        "salary_benchmarks.json": benchmarks,
        "salary_references.json": references,
    }

    print()
    for fname, rows in datasets.items():
        (out / fname).write_text(
            json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf8"
        )
        print(f"  wrote data/{fname:<26} {len(rows):>4} rows")

    if WARNINGS:
        print(f"\n{len(WARNINGS)} data-quality warning(s):")
        for w in WARNINGS:
            print(f"  ! {w}")
    print("\ndone.")


if __name__ == "__main__":
    main()

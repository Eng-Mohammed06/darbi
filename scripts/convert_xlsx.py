#!/usr/bin/env python3
"""Convert the team's spreadsheets into normalized JSON under data/.

    python3 scripts/convert_xlsx.py <dir-with-xlsx-files>

Runtime never touches .xlsx — the seed script reads data/*.json. Re-run this
only when the team ships updated spreadsheets. Stdlib only, no pip install.

Anything ambiguous (unparseable cost, malformed salary) keeps its original
string in a *_raw field and is reported under "warnings" in the summary, so
nothing gets silently invented. Judges fact-check this data.
"""
import html
import json
import os
import re
import sys
import zipfile
from pathlib import Path

WARNINGS = []


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


# ------------------------------------------------------------------- parsing --
def cell(row, i):
    return row[i].strip() if i < len(row) else ""


def is_blank_row(row):
    return not any(c.strip() for c in row)


def is_section_header(row):
    """Rows like ['1. Power Systems', '', '', '', '', ''] — a heading, not data."""
    return bool(cell(row, 0)) and not any(cell(row, i) for i in range(1, len(row)))


RANGE_RE = re.compile(r"(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)")


def parse_money_range(raw, *, context):
    """'250-350' -> (250, 350). Returns (None, None) when not confidently parseable."""
    if not raw:
        return None, None
    m = RANGE_RE.search(raw)
    if not m:
        # No range, but a lone figure ('300 JOD + Comm.') is a usable lower bound.
        single = re.search(r"(\d[\d,]*)", raw)
        if single:
            return int(single.group(1).replace(",", "")), None
        WARNINGS.append(f"cost/salary not parseable, kept raw: {raw!r} ({context})")
        return None, None
    lo_s, hi_s = m.group(1), m.group(2)
    lo, hi = int(lo_s.replace(",", "")), int(hi_s.replace(",", ""))
    # '0-100' is real (free-to-100-JOD online courses). '000-1,600' is a typo:
    # padded zeros, not a genuine bound.
    if len(lo_s) > 1 and lo_s.startswith("0"):
        WARNINGS.append(
            f"malformed low bound in {raw!r} ({context}) — left unparsed, raw kept"
        )
        return None, hi
    if lo > hi:
        WARNINGS.append(f"low > high in {raw!r} ({context}) — left unparsed")
        return None, None
    return lo, hi


def parse_gpa(raw):
    if not raw or raw.lower() in {"not stated", "n/a", "none", "-"}:
        return None
    m = re.search(r"\d(?:\.\d+)?", raw)
    return float(m.group(0)) if m else None


def split_list(raw, seps=r"[/,;]"):
    if not raw:
        return []
    return [p.strip() for p in re.split(seps, raw) if p.strip()]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ------------------------------------------------------------------ courses --
STD_HEADERS = ["sub_field", "name", "provider", "accreditation", "cost", "notes"]

# Files whose single sheet holds two majors back to back. The sub-field column
# is numbered ('1. ...', '2. ...'); the second major starts where it resets to 1.
SPLIT_FILES = {
    "civil_computerscience_engineering_courses.xlsx": ["Civil Engineering", "Computer Science"],
    "software_computerengineering_courses.xlsx": ["Software Engineering", "Computer Engineering"],
}
# Files where each sheet is one major, named after it.
SHEET_PER_MAJOR = {
    "biomedical_chemical_engineering_courses.xlsx",
    "electrical_mechanical_engineering_courses.xlsx",
}


def leading_number(text):
    m = re.match(r"\s*(\d+)\s*[.)]", text)
    return int(m.group(1)) if m else None


def std_course_rows(rows, source_file, major_for_row):
    out = []
    current_section = ""
    for row in rows[1:]:
        if is_blank_row(row):
            continue
        if is_section_header(row):
            current_section = cell(row, 0)
            continue
        name = cell(row, 1)
        if not name:
            continue
        cost_raw = cell(row, 4)
        lo, hi = parse_money_range(cost_raw, context=f"{source_file}:{name[:40]}")
        out.append(
            {
                "major_name": major_for_row(row, current_section),
                "sub_field": re.sub(r"^\s*\d+\s*[.)]\s*", "", cell(row, 0) or current_section),
                "name": name,
                "provider": cell(row, 2),
                "accreditation": cell(row, 3),
                "cost_raw": cost_raw,
                "cost_min_jod": lo,
                "cost_max_jod": hi,
                "duration": None,
                "qualifications": None,
                "notes": cell(row, 5),
                "source_file": source_file,
            }
        )
    return out


def convert_courses(src):
    courses = []

    for fname in sorted(SHEET_PER_MAJOR):
        path = src / fname
        if not path.exists():
            WARNINGS.append(f"missing expected file: {fname}")
            continue
        for sheet_name, rows in read_xlsx(path):
            courses += std_course_rows(rows, fname, lambda r, s, m=sheet_name: m)

    for fname, majors in SPLIT_FILES.items():
        path = src / fname
        if not path.exists():
            WARNINGS.append(f"missing expected file: {fname}")
            continue
        rows = read_xlsx(path)[0][1]
        # Sub-fields are numbered '1. ...', '2. ...'. The second major starts
        # where that numbering resets. A reset only counts once we've actually
        # climbed past 1 — otherwise the repeated '1.' on a section header and
        # its first data row looks like a reset and splits at row 1.
        boundary, peak = None, 0
        for i, row in enumerate(rows[1:], start=1):
            n = leading_number(cell(row, 0))
            if n is None:
                continue
            if n == 1 and peak > 1:
                boundary = i
                break
            peak = max(peak, n)
        if boundary is None:
            WARNINGS.append(f"{fname}: could not find major boundary; all rows -> {majors[0]}")
            boundary = len(rows)

        first = std_course_rows(
            [rows[0]] + rows[1:boundary], fname, lambda r, s, m=majors[0]: m
        )
        second = std_course_rows(
            [rows[0]] + rows[boundary:], fname, lambda r, s, m=majors[1]: m
        )
        print(f"  {fname}: {majors[0]}={len(first)} rows, {majors[1]}={len(second)} rows")
        courses += first + second

    # engineering_courses.xlsx has its own schema with an explicit Major column.
    path = src / "engineering_courses.xlsx"
    if path.exists():
        rows = read_xlsx(path)[0][1]
        for row in rows[1:]:
            if is_blank_row(row) or not cell(row, 2):
                continue
            cost_raw = cell(row, 5)
            lo, hi = parse_money_range(
                cost_raw, context=f"engineering_courses.xlsx:{cell(row, 2)[:40]}"
            )
            if lo is None and hi is None and cost_raw.isdigit():
                lo = hi = int(cost_raw)  # single figure, e.g. "250"
                WARNINGS.pop()  # not actually a warning
            courses.append(
                {
                    "major_name": cell(row, 1),
                    "sub_field": None,
                    "name": cell(row, 2),
                    "provider": cell(row, 6),
                    "accreditation": None,
                    "cost_raw": cost_raw,
                    "cost_min_jod": lo,
                    "cost_max_jod": hi,
                    "duration": cell(row, 4),
                    "qualifications": cell(row, 3),
                    "notes": None,
                    "source_file": "engineering_courses.xlsx",
                }
            )
    else:
        WARNINGS.append("missing expected file: engineering_courses.xlsx")

    return courses


# --------------------------------------------------------------------- jobs --
def convert_jobs(src):
    """Union of both job files, deduped on (company, title).

    companies_jobs.xlsx (50 rows) is a superset of companies_jobs_FINAL.xlsx
    (33 rows) and both are entirely 'Verified', so the larger file wins.
    """
    seen, jobs = {}, []
    for fname in ("companies_jobs.xlsx", "companies_jobs_FINAL.xlsx"):
        path = src / fname
        if not path.exists():
            WARNINGS.append(f"missing expected file: {fname}")
            continue
        for row in read_xlsx(path)[0][1][1:]:
            if is_blank_row(row):
                continue
            company, title = cell(row, 1), cell(row, 2)
            if not company or not title:
                continue
            key = (company.lower(), title.lower())
            if key in seen:
                continue
            salary_raw = cell(row, 5)
            lo, hi = parse_money_range(salary_raw, context=f"{fname}:{company}/{title[:30]}")
            status = cell(row, 8)
            seen[key] = True
            jobs.append(
                {
                    "company_name": company,
                    "title": title,
                    "required_majors": split_list(cell(row, 3)),
                    "min_gpa": parse_gpa(cell(row, 4)),
                    "salary_raw": salary_raw,
                    "salary_min_jod": lo,
                    "salary_max_jod": hi,
                    "required_skills": split_list(cell(row, 6), seps=r"[,;]"),
                    "source": cell(row, 7),
                    "verified": status.lower() == "verified",
                }
            )
    return jobs


# ----------------------------------------------------- career reference data --
def convert_career(src):
    paths, centers = [], []
    path = src / "career_courses_ENGLISH.xlsx"
    if not path.exists():
        WARNINGS.append("missing expected file: career_courses_ENGLISH.xlsx")
        return paths, centers

    for sheet_name, rows in read_xlsx(path):
        if sheet_name.lower().startswith("jordan training"):
            for row in rows[1:]:
                if is_blank_row(row) or not cell(row, 1):
                    continue
                centers.append(
                    {
                        "field": cell(row, 0),
                        "name": cell(row, 1),
                        "study_type": cell(row, 2),
                        "details": cell(row, 3),
                        "contact": cell(row, 4),
                    }
                )
        else:
            for row in rows[1:]:
                if is_blank_row(row) or not cell(row, 0):
                    continue
                paths.append(
                    {
                        "track": sheet_name,
                        "title": cell(row, 0),
                        "skills": cell(row, 1),
                        "coursera": cell(row, 2),
                        "udemy": cell(row, 3),
                        "jordan_centers": cell(row, 4),
                    }
                )
    return paths, centers


# ------------------------------------------------------------- institutions --
# Degree-granting institutions that actually appear in the team's spreadsheets.
# `aliases` are the spellings found in the files (providers use both "JUST —
# Amman" and "JUST - Campus"); `website` is only filled where a file states it.
# Nothing here is invented — `sourced_from` names the file each fact came from.
UNIVERSITIES = [
    {
        "code": "JUST",
        "name": "Jordan University of Science and Technology",
        "aliases": ["JUST"],
        "website": "just.edu.jo",
        "website_source": "DARBI_Phase2_Sprint_Plan.html",
    },
    {
        "code": "UJ",
        "name": "University of Jordan",
        "aliases": ["UJ", "University of Jordan"],
        "website": "ju.edu.jo",
        "website_source": "career_courses_ENGLISH.xlsx",
    },
    {
        "code": "GJU",
        "name": "German Jordanian University",
        "aliases": ["GJU", "German-Jordanian University", "German Jordanian University"],
        "website": "gju.edu.jo",
        "website_source": "career_courses_ENGLISH.xlsx",
    },
    {
        "code": "PSUT",
        "name": "Princess Sumaya University for Technology",
        "aliases": ["PSUT", "PSU"],
        "website": "psut.edu.jo",
        "website_source": "career_courses_ENGLISH.xlsx",
    },
    {
        "code": "HTU",
        "name": "Al Hussein Technical University",
        "aliases": ["HTU", "Hussein Technical University"],
        "website": "htu.edu.jo",
        "website_source": "career_courses_ENGLISH.xlsx",
    },
    {
        "code": "LTUC",
        "name": "Luminus Technical University College",
        "aliases": ["LTUC", "Luminus", "ASAC"],
        "website": "ltuc.com",
        "website_source": "career_courses_ENGLISH.xlsx",
    },
]


def mentions(alias, text):
    """Whole-token match, so 'PSU' doesn't fire inside another word."""
    return bool(re.search(rf"(?<![A-Za-z]){re.escape(alias)}(?![A-Za-z])", text or ""))


def match_university(text):
    for uni in UNIVERSITIES:
        if any(mentions(a, text) for a in uni["aliases"]):
            return uni
    return None


def convert_institutions(courses, career_paths, training_centers):
    """Build the university list and its links to majors, from file evidence only."""
    found = {}

    def note(uni, source_file):
        entry = found.setdefault(
            uni["code"],
            {
                "code": uni["code"],
                "name": uni["name"],
                "city": None,  # not stated per-institution in any source file
                "website": uni["website"],
                "website_source": uni["website_source"],
                "source_files": [],
                "programs_note": None,
            },
        )
        if source_file not in entry["source_files"]:
            entry["source_files"].append(source_file)
        return entry

    # 1. Course providers -> which majors each institution actually teaches.
    links = {}
    for c in courses:
        uni = match_university(c.get("provider"))
        if not uni:
            continue
        note(uni, c["source_file"])
        key = (uni["code"], c["major_name"])
        link = links.setdefault(
            key,
            {
                "university_code": uni["code"],
                "major_name": c["major_name"],
                "relation": "provides_courses",
                "course_count": 0,
                "evidence": c["provider"],
            },
        )
        link["course_count"] += 1

    # 2. Training-centre rows -> degree programmes, where a file states them.
    for t in training_centers:
        uni = match_university(t.get("name"))
        if not uni:
            continue
        entry = note(uni, "career_courses_ENGLISH.xlsx")
        if t.get("details") and not entry["programs_note"]:
            entry["programs_note"] = t["details"]

    # 3. Career-path rows cite universities in free text too.
    for p in career_paths:
        for uni in UNIVERSITIES:
            if any(mentions(a, p.get("jordan_centers") or "") for a in uni["aliases"]):
                note(uni, "career_courses_ENGLISH.xlsx")

    universities = sorted(found.values(), key=lambda u: u["code"])
    university_majors = sorted(links.values(), key=lambda l: (l["university_code"], l["major_name"]))

    for u in universities:
        offered = [l["major_name"] for l in university_majors if l["university_code"] == u["code"]]
        print(f"  {u['code']:<5} {u['name'][:46]:<46} majors: {len(offered)}")

    return universities, university_majors


# ------------------------------------------------------------------- majors --
def derive_majors(courses):
    """Majors are derived from the course data we actually have.

    Salary fields stay null: the salaries.xlsx deliverable never landed, and
    inventing figures would fail the judges' fact-check. data_quality records it.
    """
    names = sorted({c["major_name"] for c in courses if c["major_name"]})
    return [
        {
            "slug": slugify(n),
            "name": n,
            "faculty": "Engineering" if "Engineering" in n else None,
            "duration_years": None,
            "entry_requirements": None,
            "salary_entry_jod": None,
            "salary_3yr_jod": None,
            "salary_5yr_jod": None,
            "salary_source": None,
            "top_jobs": [],
            "data_quality": "pending",
        }
        for n in names
    ]


# --------------------------------------------------------------------- main --
def main():
    if len(sys.argv) < 2:
        sys.exit(f"usage: {sys.argv[0]} <dir-with-xlsx-files>")
    src = Path(sys.argv[1]).expanduser()
    if not src.is_dir():
        sys.exit(f"not a directory: {src}")

    out = Path(__file__).resolve().parent.parent / "data"
    out.mkdir(exist_ok=True)

    print(f"reading spreadsheets from {src}")
    courses = convert_courses(src)
    jobs = convert_jobs(src)
    career_paths, training_centers = convert_career(src)
    majors = derive_majors(courses)
    print("institutions:")
    universities, university_majors = convert_institutions(courses, career_paths, training_centers)

    datasets = {
        "majors.json": majors,
        "courses.json": courses,
        "jobs.json": jobs,
        "career_paths.json": career_paths,
        "training_centers.json": training_centers,
        "universities.json": universities,
        "university_majors.json": university_majors,
    }

    for fname, rows in datasets.items():
        (out / fname).write_text(
            json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf8"
        )
        print(f"  wrote data/{fname:<24} {len(rows):>4} rows")

    if WARNINGS:
        print(f"\n{len(WARNINGS)} data-quality warning(s):")
        for w in WARNINGS:
            print(f"  ! {w}")
    print("\ndone.")


if __name__ == "__main__":
    main()

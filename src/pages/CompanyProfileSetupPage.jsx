import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';
import { readAvatarFile } from '../lib/avatar.js';

/**
 * Mandatory post-verification step for company accounts — every field here
 * is required (unlike the student ProfileSetupPage, which has a skip
 * button), since these details show up on every job the company posts.
 * src/App.jsx's Dashboard guard sends a company back here on any visit
 * until all five fields are filled in, not just right after signup.
 */
export default function CompanyProfileSetupPage() {
  const navigate = useNavigate();
  const { profile, setProfile } = useAuth();
  const { t, lang } = useLang();

  const [industry, setIndustry] = useState(profile?.industry ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [logo, setLogo] = useState(profile?.logo ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const allFilled = Boolean(
    industry.trim() && description.trim() && website.trim() && location.trim() && logo,
  );

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setLogo(await readAvatarFile(file, lang));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!allFilled) {
      setError(t('companyProfileSetup.errAllRequired'));
      return;
    }
    setBusy(true);
    try {
      const updated = await api('/companies/me', {
        method: 'PUT',
        body: {
          industry: industry.trim(),
          description: description.trim(),
          website: website.trim(),
          location: location.trim(),
          logo,
        },
      });
      setProfile(updated);
      navigate('/');
    } catch (err) {
      setError(err.message ?? t('companyProfileSetup.saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <h1 className="text-lg font-bold text-darbi-navy mt-2 mb-2">{t('companyProfileSetup.heading')}</h1>
      <p className="text-sm text-gray-400 mb-5">{t('companyProfileSetup.subheading')}</p>

      <Alert>{error}</Alert>

      <form onSubmit={submit} className="space-y-4 text-start">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('companyProfileSetup.industryLabel')} *
          </span>
          <input
            className="darbi-input"
            placeholder={t('companyProfileSetup.industryPlaceholder')}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('companyProfileSetup.descriptionLabel')} *
          </span>
          <textarea
            className="darbi-input"
            rows={3}
            placeholder={t('companyProfileSetup.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('companyProfileSetup.websiteLabel')} *
          </span>
          <input
            type="url"
            className="darbi-input"
            placeholder={t('companyProfileSetup.websitePlaceholder')}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('companyProfileSetup.locationLabel')} *
          </span>
          <input
            className="darbi-input"
            placeholder={t('companyProfileSetup.locationPlaceholder')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </label>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('companyProfileSetup.logoLabel')} *
          </span>
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 10%)', border: '1px solid var(--darbi-border)' }}
            >
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl" aria-hidden="true">🏢</span>
              )}
            </div>
            <label
              className="text-xs font-semibold rounded-full px-4 py-2 border cursor-pointer transition hover:brightness-110"
              style={{ borderColor: 'var(--darbi-border)', color: 'var(--darbi-purple)' }}
            >
              {logo ? t('companyProfileSetup.changeLogoBtn') : t('companyProfileSetup.uploadLogoBtn')}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="hidden"
                onChange={onLogoChange}
              />
            </label>
          </div>
          <span className="block text-xs text-gray-500 mt-1.5">{t('companyProfileSetup.logoHint')}</span>
        </div>

        <div className="flex items-center justify-center pt-1">
          <Button type="submit" disabled={busy || !allFilled}>
            {busy ? t('companyProfileSetup.saving') : t('companyProfileSetup.continueBtn')}
          </Button>
        </div>
      </form>
    </CenteredCard>
  );
}

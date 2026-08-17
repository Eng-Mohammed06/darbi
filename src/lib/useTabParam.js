import { useSearchParams } from 'react-router-dom';

/**
 * Syncs a dashboard's active tab to a `?tab=` URL param instead of plain
 * component state. Every dashboard (Student/Company/Career/Admin) used to
 * keep its tab in a bare `useState`, which meant Overview, Jobs, and
 * every other section all lived at the same URL -- not linkable, not
 * bookmarkable, and the back button couldn't step between them even though
 * the public portal pages (/portal/student etc.) already have real routes.
 *
 * Returns the same `[tab, setTab]` shape a plain `useState` would, so the
 * rest of a dashboard's conditional rendering doesn't need to change --
 * only the one line that declares the state.
 */
export function useTabParam(defaultTab, validTabs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get('tab');
  const tab = validTabs.includes(fromUrl) ? fromUrl : defaultTab;

  function setTab(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
      return params;
    });
  }

  return [tab, setTab];
}

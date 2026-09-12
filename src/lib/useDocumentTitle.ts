import { useEffect } from 'react'

const SUFFIX = 'Delivr'

/**
 * Sets document.title for the current screen and restores it on unmount, so a
 * guest who shares or bookmarks the page gets the property / store / order name
 * instead of a bare "Delivr".
 * Pass null while the data is still loading to leave the title untouched.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title === SUFFIX ? SUFFIX : `${title} · ${SUFFIX}`
    return () => { document.title = previous }
  }, [title])
}

export default useDocumentTitle

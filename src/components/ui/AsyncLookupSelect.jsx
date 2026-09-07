// A lazy dropdown for large lookup tables (e.g. airports, 1000+ rows). Instead
// of loading the whole list, it fetches one page when the menu opens, another
// each time you scroll to the bottom, and a fresh page 1 as you type (debounced,
// searched server-side). The label of an already-selected value is resolved on
// its own so it still shows even when that row isn't in the loaded page.
//
// Built on the themed base <Select> (which forwards the extra react-select props
// via ...rest), so it looks identical to every other dropdown.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Select from './Select';

export default function AsyncLookupSelect({
  value,
  onChange,
  loadPage,        // ({ search, pageNumber, pageSize }) -> { options:[{value,label}], hasMore }
  resolveOption,   // (value) -> Promise<{value,label}|null>  — for the selected label
  pageSize = 20,
  isClearable = false,
  placeholder,
  isAr = false,
  // Forwarded to react-select so a route picker can auto-advance: after the
  // "From" airport is chosen the "To" field mounts focused with its menu open,
  // so the user keeps typing instead of clicking into a second field.
  autoFocus = false,
  openMenuOnFocus = false,
}) {
  const [options, setOptions] = useState([]);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debRef = useRef();
  const reqRef = useRef(0); // guards against out-of-order responses

  // Resolve the selected value's label when it isn't among the loaded options.
  useEffect(() => {
    if (!value) { setSelectedOpt(null); return undefined; }
    if (selectedOpt && selectedOpt.value === value) return undefined;
    const found = options.find((o) => o.value === value);
    if (found) { setSelectedOpt(found); return undefined; }
    let cancelled = false;
    resolveOption?.(value).then((o) => { if (!cancelled && o) setSelectedOpt(o); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const fetchPage = useCallback(async (pageNumber, term) => {
    const rid = ++reqRef.current;
    setLoading(true);
    try {
      const res = await loadPage({ search: term, pageNumber, pageSize });
      if (rid !== reqRef.current) return; // a newer request superseded this one
      setOptions((prev) => (pageNumber === 1 ? (res.options || []) : [...prev, ...(res.options || [])]));
      setHasMore(!!res.hasMore);
      setPage(pageNumber);
    } catch {
      if (rid === reqRef.current) { setOptions((p) => (pageNumber === 1 ? [] : p)); setHasMore(false); }
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [loadPage, pageSize]);

  const onMenuOpen = () => { if (options.length === 0) fetchPage(1, search); };
  const onMenuScrollToBottom = () => { if (hasMore && !loading) fetchPage(page + 1, search); };
  const onInputChange = (txt, meta) => {
    if (meta.action !== 'input-change') return; // ignore blur / menu-close resets
    setSearch(txt);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchPage(1, txt), 300);
  };

  // Ensure the selected option is present so its label renders.
  const merged = selectedOpt && !options.some((o) => o.value === selectedOpt.value)
    ? [selectedOpt, ...options]
    : options;

  return (
    <Select
      value={value}
      onChange={(v) => { onChange(v); setSelectedOpt(merged.find((o) => o.value === v) || null); }}
      options={merged}
      isClearable={isClearable}
      placeholder={placeholder || (isAr ? '— اختر —' : '— Select —')}
      autoFocus={autoFocus}
      openMenuOnFocus={openMenuOnFocus}
      // Server does the filtering; don't let react-select filter the page too.
      filterOption={() => true}
      isLoading={loading}
      onMenuOpen={onMenuOpen}
      onMenuScrollToBottom={onMenuScrollToBottom}
      onInputChange={onInputChange}
      noOptionsMessage={() => (loading ? (isAr ? 'جارٍ التحميل…' : 'Loading…') : (isAr ? 'لا نتائج' : 'No results'))}
    />
  );
}

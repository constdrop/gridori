// Load live ads only on the published app, not local files or deploy previews.
(() => {
  if (location.protocol !== 'https:' || location.hostname !== 'gridori.brdfld.com') return;
  if (window.innerWidth < 324) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1704995932041907';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
  (window.adsbygoogle = window.adsbygoogle || []).push({});
})();

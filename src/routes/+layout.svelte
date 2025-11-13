<script>
  import '../app.css';
  import CanvasContainer from '$lib/components/CanvasContainer.svelte';
  import FPSCounter from '$lib/components/FPSCounter.svelte';
  export const prerender = true;
</script>

<svelte:head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Parse and analyze Cossacks 3 replay files directly in your browser. Upload .rep replays to inspect players, resources, and match statistics." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://vsolanogo.github.io/cossacks-replay-parser/" />
  <link rel="icon" type="image/svg+xml" href="/cossacks-replay-parser/favicon.png" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://vsolanogo.github.io/cossacks-replay-parser/" />
  <meta property="og:title" content="Cossacks 3 Replay Parser" />
  <meta property="og:description" content="Parse and analyze your Cossacks 3 replay files in the browser to review players, resources, and match statistics from .rep files." />
  <meta property="og:site_name" content="Cossacks 3 Replay Parser" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Cossacks 3 Replay Parser" />
  <meta name="twitter:description" content="Upload .rep replay files to inspect Cossacks 3 matches, players, and resources directly in your browser." />

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-J41EVRGBHT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-J41EVRGBHT');
  </script>

  <title>Cossacks 3 Replay Parser</title>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Cossacks 3 Replay Parser",
      "url": "https://vsolanogo.github.io/cossacks-replay-parser/",
      "description": "Parse and analyze Cossacks 3 .rep replay files directly in your browser.",
      "applicationCategory": "GameUtilityApplication",
      "operatingSystem": "Web browser"
    }
  </script>
</svelte:head>

<!-- Сначала рендерим основной контент, затем канвас на заднем плане -->
<div class="app-wrapper">
  <slot />
</div>

<CanvasContainer />
<FPSCounter />

<!-- <style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  .app-wrapper {
    position: relative;
    z-index: 1;
  }
</style> -->
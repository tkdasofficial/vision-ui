import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { transform } from "https://esm.sh/sucrase@3.35.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProjectFile = { path: string; content: string };
type CompileRequest = {
  files: ProjectFile[];
  framework: string;
  dependencies: Record<string, string>;
  entryPoint?: string;
};

/* ── Transpile a single file ── */
function transpileFile(file: ProjectFile): { code: string; error?: string } {
  const ext = file.path.match(/\.(tsx?|jsx?)$/)?.[1] || "";
  if (!ext && !file.path.endsWith(".js")) return { code: file.content };

  const transforms: Array<"typescript" | "jsx"> = [];
  if (ext === "tsx" || ext === "ts") transforms.push("typescript");
  if (ext === "tsx" || ext === "jsx") transforms.push("jsx");
  if (transforms.length === 0) return { code: file.content };

  try {
    const result = transform(file.content, {
      transforms,
      jsxRuntime: "classic",
      production: false,
      filePath: file.path,
    });
    return { code: result.code };
  } catch (err: any) {
    return { code: "", error: `${file.path}: ${err.message}` };
  }
}

/* ── Extract exported names from ORIGINAL source ── */
function extractExports(code: string): { defaultExport: string | null; namedExports: string[] } {
  let defaultExport: string | null = null;
  const namedExports: string[] = [];

  // export default function Foo / export default class Foo
  let m = code.match(/export\s+default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)/);
  if (m) defaultExport = m[1];

  // export default Foo;
  if (!defaultExport) {
    m = code.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
    if (m) defaultExport = m[1];
  }

  // export default <anonymous-expression>
  if (!defaultExport && /export\s+default\s+/.test(code)) {
    defaultExport = "__default_export";
  }

  // Named exports: export const/let/var/function/class Name
  const namedPattern = /export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  let nm: RegExpExecArray | null;
  while ((nm = namedPattern.exec(code)) !== null) {
    namedExports.push(nm[1]);
  }

  // Named export list: export { Foo, Bar as Baz }
  const exportListPattern = /export\s*\{([^}]*)\}\s*;?/g;
  let em: RegExpExecArray | null;
  while ((em = exportListPattern.exec(code)) !== null) {
    const raw = em[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const item of raw) {
      const imported = item.split(/\s+as\s+/)[0]?.trim();
      if (imported) namedExports.push(imported);
    }
  }

  return { defaultExport, namedExports: Array.from(new Set(namedExports)) };
}

/* ── Strip imports/exports for inline execution ── */
function stripForInline(code: string): string {
  let result = code;

  // Remove imports (type + runtime, both normal and minified one-line output)
  result = result.replace(/^\s*import\s+type[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/import\s+[\w*{}\s,]+\s+from\s+['"][^'"]+['"];?\s*/g, "");
  result = result.replace(/import\s+['"][^'"]+['"];?\s*/g, "");

  // Keep named default declarations intact
  result = result.replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g, "function $1(");
  result = result.replace(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/g, "class $1");

  // Convert remaining default exports (anonymous function/class/expression)
  if (/export\s+default\s+/.test(result)) {
    result = result.replace(/export\s+default\s+/, "const __default_export = ");
  }

  // Remove named export keyword (keep declaration)
  result = result.replace(/^\s*export\s+(?=(?:const|let|var|function|class)\s)/gm, "");

  // Remove export lists / star exports
  result = result.replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "");
  result = result.replace(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];?\s*$/gm, "");

  return result.trim();
}

/* ── Path helpers ── */
function normalizePath(path: string): string {
  const parts = path.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/* ── Resolve import path to a file ── */
function resolveImport(importPath: string, fromPath: string, files: ProjectFile[]): ProjectFile | null {
  const baseCandidates: string[] = [];

  if (importPath.startsWith(".")) {
    const base = dirname(fromPath);
    baseCandidates.push(normalizePath(`${base}/${importPath}`));
  } else if (importPath.startsWith("src/")) {
    baseCandidates.push(normalizePath(importPath));
  } else {
    return null;
  }

  const candidates: string[] = [];
  for (const base of baseCandidates) {
    candidates.push(base);
    candidates.push(`${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`);
    candidates.push(`${base}/index.tsx`, `${base}/index.ts`, `${base}/index.jsx`, `${base}/index.js`);
  }

  for (const candidate of candidates) {
    const found = files.find(f => normalizePath(f.path) === normalizePath(candidate));
    if (found) return found;
  }

  return null;
}

type ParsedImport = {
  defaultImport: string | null;
  namedImports: Array<{ imported: string; local: string }>;
  path: string;
};

type ModuleBindings = {
  defaultNames: Set<string>;
  namedBindings: Map<string, string>; // localName -> exportedName
};

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/* ── Parse imports from a file to build dependency graph and symbol bindings ── */
function parseImports(code: string): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // import Default from './path'
  // import { Named1, Named2 as Alias } from './path'
  // import Default, { Named } from './path'
  const importRegex = /^\s*import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s*)?['"]([^'"]+)['"];?\s*$/gm;
  let m: RegExpExecArray | null;

  while ((m = importRegex.exec(code)) !== null) {
    const statement = m[0];
    if (/^\s*import\s+type\b/.test(statement)) continue;

    const defaultImport = m[1] || null;
    const namedImports = (m[2] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((token) => {
        const [importedRaw, localRaw] = token.split(/\s+as\s+/).map((s) => s.trim());
        const imported = importedRaw || "";
        const local = localRaw || imported;
        return { imported, local };
      })
      .filter((item) => item.imported && item.local);

    const path = m[3];
    if (path.startsWith(".") || path.startsWith("src/")) {
      imports.push({ defaultImport, namedImports, path });
    }
  }

  return imports;
}

function collectModuleBindings(files: ProjectFile[]): Map<string, ModuleBindings> {
  const bindings = new Map<string, ModuleBindings>();

  for (const file of files) {
    const imports = parseImports(file.content);
    for (const imp of imports) {
      const resolved = resolveImport(imp.path, file.path, files);
      if (!resolved) continue;

      const key = normalizePath(resolved.path);
      if (!bindings.has(key)) {
        bindings.set(key, {
          defaultNames: new Set<string>(),
          namedBindings: new Map<string, string>(),
        });
      }

      const current = bindings.get(key)!;
      if (imp.defaultImport && isValidIdentifier(imp.defaultImport)) {
        current.defaultNames.add(imp.defaultImport);
      }

      for (const named of imp.namedImports) {
        if (isValidIdentifier(named.local) && isValidIdentifier(named.imported)) {
          current.namedBindings.set(named.local, named.imported);
        }
      }
    }
  }

  return bindings;
}

/* ── Build import map for CDN deps ── */
function buildImportMap(dependencies: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {
    "react": "https://esm.sh/react@18.3.1?dev",
    "react/": "https://esm.sh/react@18.3.1/",
    "react-dom": "https://esm.sh/react-dom@18.3.1?dev",
    "react-dom/": "https://esm.sh/react-dom@18.3.1/",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?dev",
    "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime?dev",
    "react-router-dom": "https://esm.sh/react-router-dom@6?dev&deps=react@18.3.1,react-dom@18.3.1",
  };
  for (const [pkg, version] of Object.entries(dependencies)) {
    if (!map[pkg]) {
      const ver = version.replace(/[\^~>=<]*/g, "");
      map[pkg] = `https://esm.sh/${pkg}@${ver}?deps=react@18.3.1,react-dom@18.3.1`;
    }
  }
  return map;
}

/* ── Console capture injection ── */
function injectConsoleCapture(): string {
  return `<script>
(function() {
  const _log = console.log, _warn = console.warn, _err = console.error;
  function relay(level, args) {
    try {
      const msg = Array.from(args).map(a => {
        if (typeof a === 'object') try { return JSON.stringify(a, null, 2); } catch { return String(a); }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'console', level, message: msg }, '*');
    } catch {}
  }
  console.log = function() { relay('log', arguments); _log.apply(console, arguments); };
  console.warn = function() { relay('warn', arguments); _warn.apply(console, arguments); };
  console.error = function() { relay('error', arguments); _err.apply(console, arguments); };
  window.onerror = function(msg, src, line) {
    relay('error', [msg + (line ? ' (line ' + line + ')' : '')]);
  };
  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason?.stack || e.reason?.message || String(e.reason);
    relay('error', [msg]);
  });
})();
<\/script>`;
}

/* ── Find entry point ── */
function findEntryPoint(files: ProjectFile[], framework: string, hint?: string): string | null {
  // Vanilla projects can use HTML/JS directly
  if (framework === "vanilla-html") {
    if (hint) {
      const found = files.find(f => f.path === hint || f.path.endsWith(hint));
      if (found) return found.path;
    }
    for (const e of ["index.html", "src/index.html", "main.js", "script.js"]) {
      if (files.find(f => f.path === e)) return e;
    }
    return files.find(f => /\.(html|js|ts)$/.test(f.path))?.path || null;
  }

  // For React projects, prefer boot files (main/index), never raw HTML.
  if (hint && /\.(tsx?|jsx?)$/.test(hint)) {
    const found = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (found) return found.path;
  }

  // If hint points to HTML, extract module script src (e.g. /src/main.tsx)
  if (hint && hint.endsWith(".html")) {
    const html = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (html) {
      const m = html.content.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i);
      if (m?.[1]) {
        const src = m[1].replace(/^\//, "");
        const fromHtml = files.find(f => f.path === src || f.path.endsWith(src));
        if (fromHtml && /\.(tsx?|jsx?)$/.test(fromHtml.path)) return fromHtml.path;
      }
    }
  }

  const entries = [
    "src/main.tsx", "src/main.jsx", "main.tsx", "main.jsx",
    "src/index.tsx", "src/index.jsx", "index.tsx", "index.jsx",
    "src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx",
  ];

  for (const entry of entries) {
    if (files.find(f => f.path === entry)) return entry;
  }

  return files.find(f => /\.(tsx?|jsx?)$/.test(f.path))?.path || null;
}

/* ── Topological sort of modules ── */
function topoSort(
  entryPath: string,
  files: ProjectFile[],
): { sorted: ProjectFile[]; appFile: ProjectFile | null } {
  const visited = new Set<string>();
  const sorted: ProjectFile[] = [];
  let appFile: ProjectFile | null = null;

  function visit(filePath: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    
    const file = files.find(f => f.path === filePath);
    if (!file) return;

    // Parse imports and visit dependencies first
    const imports = parseImports(file.content);
    for (const imp of imports) {
      const resolved = resolveImport(imp.path, file.path, files);
      if (resolved) visit(resolved.path);
    }

    if (filePath === entryPath) {
      appFile = file;
    } else {
      sorted.push(file);
    }
  }

  visit(entryPath);
  
  // Add any remaining module files not reached by imports
  for (const f of files) {
    if (/\.(tsx?|jsx?)$/.test(f.path) && !visited.has(f.path) && !f.path.includes("main.")) {
      sorted.push(f);
    }
  }

  return { sorted, appFile };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CompileRequest = await req.json();
    const { files, framework, dependencies, entryPoint } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Vanilla HTML ───
    if (framework === "vanilla-html") {
      const htmlFile = files.find(f => f.path.endsWith(".html"));
      const cssFiles = files.filter(f => f.path.endsWith(".css"));
      const jsFiles = files.filter(f => /\.(js|ts)$/.test(f.path));
      
      const transpiledJS: string[] = [];
      const warnings: string[] = [];
      for (const js of jsFiles) {
        const result = transpileFile(js);
        if (result.error) {
          warnings.push(`Skipped ${js.path}: ${result.error}`);
          transpiledJS.push(`/* error in ${js.path} */`);
        } else {
          transpiledJS.push(stripForInline(result.code));
        }
      }

      const cssContent = cssFiles.map(f => f.content).join("\n");
      let html: string;

      if (htmlFile) {
        html = htmlFile.content;
        for (const css of cssFiles) {
          const pat = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${css.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, "gi");
          html = html.replace(pat, `<style>${css.content}</style>`);
        }
        for (let i = 0; i < jsFiles.length; i++) {
          const js = jsFiles[i];
          const pat = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${js.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, "gi");
          html = html.replace(pat, `<script>${transpiledJS[i]}<\/script>`);
        }
        if (!html.includes("<style>") && cssContent) {
          html = html.replace("</head>", `<style>${cssContent}</style>\n</head>`);
        }
      } else {
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script><style>${cssContent}</style></head><body><script>${transpiledJS.join("\n")}<\/script></body></html>`;
      }

      if (html.includes("</head>")) {
        html = html.replace("</head>", injectConsoleCapture() + "\n</head>");
      } else {
        html += injectConsoleCapture();
      }

      return new Response(
        JSON.stringify({ success: true, html, compiledFiles: files.length, bundleSize: html.length, warnings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── React / Next.js ───
    const entry = findEntryPoint(files, framework, entryPoint);
    if (!entry) {
      return new Response(
        JSON.stringify({ error: "No entry point found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cssContent = files.filter(f => f.path.endsWith(".css")).map(f => f.content).join("\n");
    const warnings: string[] = [];

    // Topologically sort modules so dependencies come before dependents
    const { sorted: depModules, appFile } = topoSort(entry, files);
    const bindingsByModule = collectModuleBindings(files);

    // Transpile and build each module, exposing exports as global variables
    const moduleBlocks: string[] = [];

    for (const file of depModules) {
      const result = transpileFile(file);
      if (result.error) {
        warnings.push(`Skipped ${file.path}: ${result.error}`);
        continue;
      }

      const stripped = stripForInline(result.code);
      const exports = extractExports(file.content);
      const moduleBindings = bindingsByModule.get(normalizePath(file.path));

      const exposedMap = new Map<string, string>(); // exposedName -> source expression

      for (const named of exports.namedExports) {
        if (isValidIdentifier(named)) {
          exposedMap.set(named, `typeof ${named} !== 'undefined' ? ${named} : undefined`);
        }
      }

      if (exports.defaultExport && isValidIdentifier(exports.defaultExport)) {
        const defaultExpr = `typeof ${exports.defaultExport} !== 'undefined' ? ${exports.defaultExport} : undefined`;
        const defaultTargets = moduleBindings && moduleBindings.defaultNames.size > 0
          ? Array.from(moduleBindings.defaultNames)
          : [exports.defaultExport];

        for (const target of defaultTargets) {
          if (isValidIdentifier(target)) {
            exposedMap.set(target, defaultExpr);
          }
        }
      }

      if (moduleBindings) {
        for (const [localName, exportedName] of moduleBindings.namedBindings.entries()) {
          if (isValidIdentifier(localName) && isValidIdentifier(exportedName)) {
            exposedMap.set(localName, `typeof ${exportedName} !== 'undefined' ? ${exportedName} : undefined`);
          }
        }
      }

      const exposedEntries = Array.from(exposedMap.entries());
      const returnObj = exposedEntries.length > 0
        ? `return { ${exposedEntries
            .map(([name, expr]) => `${JSON.stringify(name)}: (${expr})`)
            .join(", ")} };`
        : "return {};";

      moduleBlocks.push(`
// ── ${file.path} ──
var __mod_result = (function() {
  try {
    ${stripped}
    ${returnObj}
  } catch(e) {
    console.warn("Module ${file.path} error:", e.message);
    return {};
  }
})();
${exposedEntries.map(([name]) => `var ${name} = __mod_result[${JSON.stringify(name)}];`).join("\n")}
`);
    }

    // Transpile app entry
    let appCode = "";
    if (appFile) {
      const result = transpileFile(appFile);
      if (result.error) {
        warnings.push(`App entry error: ${result.error}`);
        appCode = "function App() { return React.createElement('div', {style:{padding:'2rem',textAlign:'center'}}, 'Compilation error in App'); }";
      } else {
        appCode = stripForInline(result.code);
      }
    } else {
      appCode = "function App() { return React.createElement('div', {style:{padding:'2rem',textAlign:'center'}}, 'No App component found'); }";
    }

    const importMap = buildImportMap(dependencies);
    const importMapJSON = JSON.stringify({ imports: importMap }, null, 2);
    const isBootEntry = /(?:^|\/)(main|index)\.(tsx?|jsx?)$/.test(entry);

    const renderBlock = isBootEntry
      ? `
    // Boot file already mounted the app.
    `
      : `
    const AppComponent = typeof App !== 'undefined' ? App :
                         (() => React.createElement('div', {style:{padding:'2rem',textAlign:'center',fontFamily:'system-ui'}},
                           React.createElement('h2', null, 'No App component found')));

    try {
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(AppComponent));
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<div style="padding:2rem;color:#f38ba8;font-family:monospace"><h3>Render Error</h3><pre>' +
        String(err?.stack || err?.message || err).split('<').join('&lt;') + '</pre></div>';
      console.error('Render failed:', err);
    }
    `;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script type="importmap">
  ${importMapJSON}
  <\/script>
  <style>${cssContent}</style>
  ${injectConsoleCapture()}
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React, { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext, useReducer, forwardRef, memo, Fragment, Suspense, lazy } from 'react';
    import { createRoot } from 'react-dom/client';

    // Globals used by transpiled JSX or legacy snippets
    const ReactDOM = { createRoot };
    window.React = React;
    window.ReactDOM = ReactDOM;

    // Import router (may not be used, wrapped in try)
    let HashRouter, BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useLocation, Navigate, Outlet, useSearchParams;
    try {
      const router = await import('react-router-dom');
      HashRouter = router.HashRouter;
      BrowserRouter = router.BrowserRouter;
      Routes = router.Routes;
      Route = router.Route;
      Link = router.Link;
      NavLink = router.NavLink;
      useNavigate = router.useNavigate;
      useParams = router.useParams;
      useLocation = router.useLocation;
      Navigate = router.Navigate;
      Outlet = router.Outlet;
      useSearchParams = router.useSearchParams;
    } catch(e) {
      console.warn('react-router-dom not available:', e.message);
    }

    // ── Dependency modules (topological order) ──
    ${moduleBlocks.join("\n")}

    // ── App/bootstrap entry ──
    ${appCode}

    ${renderBlock}
  <\/script>
</body>
</html>`;

    return new Response(
      JSON.stringify({
        success: true,
        html,
        compiledFiles: depModules.length + 1,
        bundleSize: html.length,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Compile error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal compilation error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

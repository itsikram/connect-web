// Runs after `react-scripts build`. Renders the public pages that logged-out
// visitors land on (/ and /about) to static HTML, plus a minified copy of
// their stylesheet, into build/prerender/. server.js puts both into the
// HTML it serves so the first paint needs no JavaScript or CSS download;
// React (PublicApp) then replaces the markup with the same markup.
process.env.BABEL_ENV = "test"; // babel-preset-react-app: CommonJS for Node
process.env.NODE_ENV = "test"; // matching React build (the preset emits jsxDEV)

const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "build", "prerender");

const compile = (module, filename) => {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("babel-preset-react-app"), { runtime: "automatic" }]],
  });
  module._compile(code, filename);
};
const defaultJs = Module._extensions[".js"];
for (const ext of [".js", ".jsx"]) {
  Module._extensions[ext] = (module, filename) =>
    filename.startsWith(SRC) ? compile(module, filename) : defaultJs(module, filename);
}
for (const ext of [".css", ".scss"]) Module._extensions[ext] = () => {};

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { StaticRouter } = require("react-router-dom/server");

const render = (location, file) => {
  const mod = require(path.join(SRC, file));
  const Page = mod.default || mod;
  return renderToStaticMarkup(
    React.createElement(StaticRouter, { location }, React.createElement(Page))
  );
};

const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "home.html"), render("/", "components/LandingPage.jsx"));
fs.writeFileSync(path.join(OUT, "about.html"), render("/about", "pages/AboutConnect.js"));
fs.writeFileSync(
  path.join(OUT, "public.css"),
  minifyCss(fs.readFileSync(path.join(SRC, "components", "LandingPage.css"), "utf8"))
);
console.log("Pre-rendered / and /about into build/prerender/");

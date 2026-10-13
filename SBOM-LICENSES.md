# Software Bill of Materials and License Overview

This document summarizes the software components used by **wafpass-dashboard**
and their licenses. It is generated for CNCF submission readiness.

## Project metadata

- **Project:** wafpass-dashboard
- **Own license:** Apache-2.0
- **License file present:** yes

## SBOM artifacts

Every build produces the following artifacts (uploaded to GitHub Actions):

- `sbom.cyclonedx.json` — CycloneDX 1.6 JSON
- `sbom.spdx.json` — SPDX 2.3 JSON
- `licenses.json` — License report (JSON)

Release builds also attach the CycloneDX and SPDX files to the GitHub release.

## Dependency summary

- **Total detected packages:** 126

### License distribution

| License | Count |
|---------|-------|
| MIT | 96 |
| ISC | 20 |
| BSD-3-Clause | 6 |
| BSD-2-Clause | 3 |
| Apache-2.0 | 1 |

## Package list

| Package | Version | License |
|---------|---------|---------|
| @babel/runtime | 7.29.7 | MIT |
| @esbuild/aix-ppc64 | 0.28.2 | MIT |
| @esbuild/android-arm | 0.28.2 | MIT |
| @esbuild/android-arm64 | 0.28.2 | MIT |
| @esbuild/android-x64 | 0.28.2 | MIT |
| @esbuild/darwin-arm64 | 0.28.2 | MIT |
| @esbuild/darwin-x64 | 0.28.2 | MIT |
| @esbuild/freebsd-arm64 | 0.28.2 | MIT |
| @esbuild/freebsd-x64 | 0.28.2 | MIT |
| @esbuild/linux-arm | 0.28.2 | MIT |
| @esbuild/linux-arm64 | 0.28.2 | MIT |
| @esbuild/linux-ia32 | 0.28.2 | MIT |
| @esbuild/linux-loong64 | 0.28.2 | MIT |
| @esbuild/linux-mips64el | 0.28.2 | MIT |
| @esbuild/linux-ppc64 | 0.28.2 | MIT |
| @esbuild/linux-riscv64 | 0.28.2 | MIT |
| @esbuild/linux-s390x | 0.28.2 | MIT |
| @esbuild/linux-x64 | 0.28.2 | MIT |
| @esbuild/netbsd-arm64 | 0.28.2 | MIT |
| @esbuild/netbsd-x64 | 0.28.2 | MIT |
| @esbuild/openbsd-arm64 | 0.28.2 | MIT |
| @esbuild/openbsd-x64 | 0.28.2 | MIT |
| @esbuild/openharmony-arm64 | 0.28.2 | MIT |
| @esbuild/sunos-x64 | 0.28.2 | MIT |
| @esbuild/win32-arm64 | 0.28.2 | MIT |
| @esbuild/win32-ia32 | 0.28.2 | MIT |
| @esbuild/win32-x64 | 0.28.2 | MIT |
| @mapbox/jsonlint-lines-primitives | 2.0.3 | MIT |
| @mapbox/point-geometry | 1.1.0 | ISC |
| @mapbox/tiny-sdf | 2.2.0 | BSD-2-Clause |
| @mapbox/unitbezier | 0.0.1 | BSD-2-Clause |
| @mapbox/unitbezier | 1.0.0 | BSD-2-Clause |
| @mapbox/vector-tile | 3.0.0 | BSD-3-Clause |
| @maplibre/geojson-vt | 6.1.2 | ISC |
| @maplibre/maplibre-gl-style-spec | 19.3.3 | ISC |
| @maplibre/maplibre-gl-style-spec | 26.4.4 | ISC |
| @maplibre/mlt | 1.3.0 | MIT OR Apache-2.0 |
| @maplibre/vt-pbf | 4.3.2 | MIT |
| @remix-run/router | 1.23.4 | MIT |
| @types/d3-array | 3.2.2 | MIT |
| @types/d3-color | 3.1.3 | MIT |
| @types/d3-ease | 3.0.2 | MIT |
| @types/d3-interpolate | 3.0.4 | MIT |
| @types/d3-path | 3.1.1 | MIT |
| @types/d3-scale | 4.0.9 | MIT |
| @types/d3-shape | 3.2.0 | MIT |
| @types/d3-time | 3.0.4 | MIT |
| @types/d3-timer | 3.0.2 | MIT |
| @types/geojson | 7946.0.16 | MIT |
| @vis.gl/react-mapbox | 8.1.3 | MIT |
| @vis.gl/react-maplibre | 8.1.3 | MIT |
| arr-union | 3.1.0 | MIT |
| assign-symbols | 1.0.0 | MIT |
| bidi-js | 1.1.0 | MIT |
| bytewise | 1.1.0 | MIT |
| bytewise-core | 1.2.3 | MIT |
| clsx | 2.1.1 | MIT |
| csstype | 3.2.3 | MIT |
| d3-array | 3.2.4 | ISC |
| d3-color | 3.1.0 | ISC |
| d3-ease | 3.0.1 | BSD-3-Clause |
| d3-format | 3.1.2 | ISC |
| d3-interpolate | 3.0.1 | ISC |
| d3-path | 3.1.0 | ISC |
| d3-scale | 4.0.2 | ISC |
| d3-shape | 3.2.0 | ISC |
| d3-time | 3.1.0 | ISC |
| d3-time-format | 4.1.0 | ISC |
| d3-timer | 3.0.1 | ISC |
| decimal.js-light | 2.5.1 | MIT |
| dom-helpers | 5.2.1 | MIT |
| earcut | 3.2.4 | ISC |
| esbuild | 0.28.2 | MIT |
| eventemitter3 | 4.0.7 | MIT |
| extend-shallow | 2.0.1 | MIT |
| extend-shallow | 3.0.2 | MIT |
| fast-equals | 5.4.3 | MIT |
| get-value | 2.0.6 | MIT |
| gl-matrix | 3.4.4 | MIT |
| internmap | 2.0.3 | ISC |
| is-extendable | 0.1.1 | MIT |
| is-extendable | 1.0.1 | MIT |
| is-plain-object | 2.0.4 | MIT |
| isobject | 3.0.1 | MIT |
| js-tokens | 4.0.0 | MIT |
| json-stringify-pretty-compact | 3.0.0 | MIT |
| json-stringify-pretty-compact | 4.0.0 | MIT |
| kdbush | 4.1.0 | ISC |
| lodash | 4.18.1 | MIT |
| loose-envify | 1.4.0 | MIT |
| maplibre-gl | 6.12.0 | BSD-3-Clause |
| minimist | 1.2.8 | MIT |
| murmurhash-js | 1.0.0 | MIT |
| object-assign | 4.1.1 | MIT |
| pbf | 5.1.2 | BSD-3-Clause |
| potpack | 2.1.0 | ISC |
| prop-types | 15.8.1 | MIT |
| protocol-buffers-schema | 3.6.1 | MIT |
| quickselect | 3.0.0 | ISC |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-is | 16.13.1 | MIT |
| react-is | 18.3.1 | MIT |
| react-map-gl | 8.1.3 | MIT |
| react-router | 6.30.6 | MIT |
| react-router-dom | 6.30.6 | MIT |
| react-smooth | 4.0.4 | MIT |
| react-transition-group | 4.4.5 | BSD-3-Clause |
| recharts | 2.15.4 | MIT |
| recharts-scale | 0.4.5 | MIT |
| require-from-string | 2.0.2 | MIT |
| resolve-protobuf-schema | 2.1.0 | MIT |
| rw | 1.3.3 | BSD-3-Clause |
| scheduler | 0.23.2 | MIT |
| set-value | 2.0.1 | MIT |
| sort-asc | 0.2.0 | MIT |
| sort-desc | 0.2.0 | MIT |
| sort-object | 3.0.3 | MIT |
| split-string | 3.1.0 | MIT |
| tiny-invariant | 1.3.3 | MIT |
| tinyqueue | 3.0.0 | ISC |
| typewise | 1.0.3 | MIT |
| typewise-core | 1.2.0 | MIT |
| union-value | 1.0.1 | MIT |
| victory-vendor | 36.9.2 | MIT AND ISC |
| wafpass-dashboard | 1.1.0 | Apache-2.0 |

---

*Generated automatically from SBOM and license scan data.*

# @hyoban/trip-map

Bokushi uses the upstream map, scroll controller and player from [hyoban/hyoban.cc at 257dff2](https://github.com/hyoban/hyoban.cc/tree/257dff2412f109721cbe0d2963230d8d41c99d35/packages/trip-map). The npm registry did not have this package when it was integrated. The tarball contains the upstream distribution, source maps, MIT license and third-party notices.

To rebuild the archive in a checkout of that revision, run:

```sh
pnpm --filter @hyoban/trip-map... install --frozen-lockfile --ignore-scripts
pnpm --filter @hyoban/trip-map run build
cd packages/trip-map
pnpm pack
```

Rename the generated tarball to `trip-map-257dff2.tgz` in this directory.

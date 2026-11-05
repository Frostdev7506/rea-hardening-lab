# Dispatch Lab

Requires Node 24 and the provided dependencies.

```sh
npm run build
npm start -- --port 3000
```

Open `http://127.0.0.1:3000/` for dispatch or `/quote` for parcel quotes.

`DISPATCH_DB_PATH` and `DEMO_DB_PATH` select separate writable SQLite files. Defaults are `.data/dispatch.sqlite` and `.data/quotes.sqlite`, relative to the application working directory. Parent directories are created automatically.

The network fixture is embedded in `src/lib/fixture.json`. Runtime code does not depend on the reconstruction inputs or analysis tools. See the trial-level `report.md` for recovered behavior and verification evidence.

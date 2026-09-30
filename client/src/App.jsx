import { useEffect, useState } from "react";
import { api } from "./api";

const ago = (d) => {
  if (!d) return "No clicks yet";
  const m = Math.round((Date.now() - new Date(d)) / 6e4);
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${Math.round(m / 1440)} d ago`;
};
const status = (l) =>
  !l.clicks
    ? ["idle", "No clicks"]
    : Date.now() - new Date(l.lastClick) < 864e5
      ? ["hot", "Active today"]
      : ["ok", "Active"];

function Chips({ items, onPick }) {
  return (
    <div className="chips">
      {items.map((i) => (
        <button
          type="button"
          key={i.slug}
          disabled={!i.available}
          className={"chip" + (i.available ? "" : " off")}
          onClick={() => onPick(i.slug)}
        >
          {i.slug}
          {!i.available && " (taken)"}
        </button>
      ))}
    </div>
  );
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login"),
    [f, setF] = useState({ email: "", password: "" }),
    [err, setErr] = useState("");
  const go = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      localStorage.token = (await api("/auth/" + mode, "POST", f)).token;
      onAuth();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={go}>
        <h1>SmartLink</h1>
        <p className="muted">
          Short links with names you can read, grouped by project.
        </p>
        <input
          placeholder="Email"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          required
        />
        <input
          placeholder="Password (6+ characters)"
          type="password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          required
        />
        {err && <p className="err">{err}</p>}
        <button className="btn">
          {mode === "login" ? "Log in" : "Create account"}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ open }) {
  const [st, setSt] = useState(null),
    [ps, setPs] = useState([]),
    [name, setName] = useState("");
  const [sug, setSug] = useState([]),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () => {
    api("/stats").then(setSt);
    api("/projects").then(setPs);
  };
  useEffect(() => {
    load();
  }, []);
  const add = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/projects", "POST", { name });
      setName("");
      setSug([]);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const suggest = async () => {
    setBusy(true);
    setErr("");
    try {
      setSug(
        (await api("/projects/suggest", "POST", { hint: name })).suggestions,
      );
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };
  const del = async (p) => {
    if (confirm(`Delete "${p.slug}" and all its links?`)) {
      await api("/projects/" + p._id, "DELETE");
      load();
    }
  };
  if (!st) return <p className="muted">Loading…</p>;
  const max = Math.max(1, ...st.series.map((d) => d.clicks));
  return (
    <>
      <div className="stats">
        <div className="card stat">
          <b>{st.clicks}</b>
          <span>Total clicks</span>
        </div>
        <div className="card stat">
          <b>{st.links}</b>
          <span>Links</span>
        </div>
        <div className="card stat">
          <b>{st.projects}</b>
          <span>Projects</span>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Clicks in the last 7 days</h3>
          <div className="chart">
            {st.series.map((d) => (
              <div key={d.day} className="col">
                <em>{d.clicks}</em>
                <div
                  className="colbar"
                  style={{ height: (d.clicks / max) * 100 + "%" }}
                />
                <small>{d.day.slice(5)}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Top links</h3>
          {st.top.length === 0 && (
            <p className="muted">
              Create a link and share it. Clicks show up here.
            </p>
          )}
          {st.top.map((l) => (
            <div key={l.id} className="toprow">
              <span className="short">
                {l.shortUrl.replace(/^https?:\/\//, "")}
              </span>
              <b>{l.clicks}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>New project</h3>
        <p className="muted">
          The project name becomes the first part of every link: host/
          <b>project-name</b>/link-name
        </p>
        <form className="row" onSubmit={add}>
          <input
            placeholder="Project name, or describe it and get ideas"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={suggest}
            disabled={busy}
          >
            {busy ? "Thinking…" : "Suggest names"}
          </button>
          <button className="btn" disabled={!name.trim()}>
            Create project
          </button>
        </form>
        {sug.length > 0 && <Chips items={sug} onPick={setName} />}
        {err && <p className="err">{err}</p>}
      </div>
      <h2>Your projects</h2>
      {ps.length === 0 && (
        <p className="muted">
          No projects yet. Create one above to start adding links.
        </p>
      )}
      <div className="projects">
        {ps.map((p) => (
          <div key={p._id} className="card proj" onClick={() => open(p)}>
            <h3>/{p.slug}</h3>
            <div className="pmeta">
              <span>
                <b>{p.links}</b> links
              </span>
              <span>
                <b>{p.clicks}</b> clicks
              </span>
            </div>
            <button
              className="link danger"
              onClick={(e) => {
                e.stopPropagation();
                del(p);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Project({ p, back }) {
  const [d, setD] = useState(null),
    [url, setUrl] = useState(""),
    [slug, setSlug] = useState("");
  const [sug, setSug] = useState([]),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState("");
  const load = () =>
    api(`/projects/${p._id}/links`)
      .then(setD)
      .catch((x) => setErr(x.message));
  useEffect(() => {
    load();
  }, []);
  const run = async (key, fn) => {
    setErr("");
    setBusy(key);
    try {
      await fn();
    } catch (x) {
      setErr(x.message);
    }
    setBusy("");
  };
  const suggest = () =>
    run("s", async () =>
      setSug(
        (await api(`/projects/${p._id}/links/suggest`, "POST", { url, slug}))
          .suggestions,
      ),
    );
  const add = (e) => {
    e.preventDefault();
    run("a", async () => {
      await api(`/projects/${p._id}/links`, "POST", { url, slug });
      setUrl("");
      setSlug("");
      setSug([]);
      await load();
    });
  };
  const regen = (l) =>
    run(l.id, async () => {
      await api(`/links/${l.id}/regenerate`, "POST");
      await load();
    });
  const edit = (l) => {
    const v = prompt("New link name", l.slug);
    if (v && v !== l.slug)
      run(l.id, async () => {
        await api(`/links/${l.id}`, "PUT", { slug: v });
        await load();
      });
  };
  const del = (l) => {
    if (confirm("Delete this link?"))
      run(l.id, async () => {
        await api(`/links/${l.id}`, "DELETE");
        await load();
      });
  };
  const copy = (l) => navigator.clipboard.writeText(l.shortUrl);
  const links = d?.links || [],
    max = Math.max(1, ...links.map((l) => l.clicks));
  return (
    <>
      <button className="link" onClick={back}>
        ‹ All projects
      </button>
      <h2>/{p.slug}</h2>
      <div className="card">
        <h3>Add a link</h3>
        <form onSubmit={add}>
          <input
            placeholder="Paste the long URL (https://…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div className="row">
            <input
              placeholder="Link name (leave empty and AI picks one)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={suggest}
              disabled={!url || busy === "s"}
            >
              {busy === "s" ? "Thinking…" : "Suggest names"}
            </button>
            <button className="btn" disabled={!url || busy === "a"}>
              {busy === "a" ? "Adding…" : "Add link"}
            </button>
          </div>
        </form>
        {sug.length > 0 && <Chips items={sug} onPick={setSlug} />}
        {err && <p className="err">{err}</p>}
      </div>
      <div className="card">
        <h3>Links</h3>
        {d && links.length === 0 && (
          <p className="muted">
            No links yet. Paste a URL above to create the first one.
          </p>
        )}
        <div className="table">
          {links.map((l) => {
            const [c, t] = status(l);
            return (
              <div className="lrow" key={l.id}>
                <div className="lmain">
                  <a
                    className="short"
                    href={l.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.shortUrl.replace(/^https?:\/\//, "")}
                  </a>
                  <div className="muted small ellip">{l.url}</div>
                </div>
                <div className="lclicks">
                  <div className="bar">
                    <span style={{ width: (l.clicks / max) * 100 + "%" }} />
                  </div>
                  <b>{l.clicks}</b> clicks ·{" "}
                  <span className="muted">{ago(l.lastClick)}</span>
                </div>
                <span className={"pill " + c}>{t}</span>
                <div className="acts">
                  <button className="link" onClick={() => copy(l)}>
                    Copy
                  </button>
                  <button
                    className="link"
                    disabled={busy === l.id}
                    onClick={() => regen(l)}
                  >
                    New AI name
                  </button>
                  <button className="link" onClick={() => edit(l)}>
                    Edit
                  </button>
                  <button className="link danger" onClick={() => del(l)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.token),
    [proj, setProj] = useState(null);
  if (!authed) return <Auth onAuth={() => setAuthed(true)} />;
  return (
    <div className="shell">
      <header>
        <span className="logo" onClick={() => setProj(null)}>
          SmartLink
        </span>
        <button
          className="link"
          onClick={() => {
            localStorage.removeItem("token");
            setAuthed(false);
          }}
        >
          Log out
        </button>
      </header>
      <main>
        {proj ? (
          <Project p={proj} back={() => setProj(null)} />
        ) : (
          <Dashboard open={setProj} />
        )}
      </main>
    </div>
  );
}

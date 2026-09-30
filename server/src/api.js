const r = require("express").Router();
const jwt = require("jsonwebtoken"),
  bcrypt = require("bcryptjs"),
  crypto = require("crypto");
const mongoose = require("mongoose");
const { User, Project, Link } = require("./models");
const ai = require("./ai");
const { clean } = ai;

const RESERVED = [
  "api",
  "admin",
  "login",
  "register",
  "dashboard",
  "assets",
  "static",
];
const h = (fn) => (q, s, n) => fn(q, s, n).catch(n); // duck the error handling boilerplate for async route handlers
const fail = (status, message) => Object.assign(new Error(message), { status });
const secret = () => process.env.JWT_SECRET || "dev_secret";
const oid = (id) => new mongoose.Types.ObjectId(id);
const sign = (u) => jwt.sign({ id: u.id }, secret(), { expiresIn: "7d" });
const auth = (q, s, n) => {
  try {
    q.user = jwt.verify(
      (q.headers.authorization || "").replace("Bearer ", ""),
      secret(),
    );
    n();
  } catch {
    s.status(401).json({ error: "Please log in" });
  }
};
const validUrl = (v) => {
  try {
    const u = new URL(String(v || "").trim());
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
const short = (p, l) =>
  `${process.env.BASE_URL || "http://localhost:5001"}/${p}/${l}`;
const dto = (l, p) => ({
  // data transfer object: only send what the client needs
  id: l._id,
  url: l.originalUrl,
  slug: l.slug,
  shortUrl: short(p.slug, l.slug),
  clicks: l.clicks,
  lastClick: l.clickLog?.at(-1)?.at || null,
  createdAt: l.createdAt,
});

/* ---------- auth ---------- */
r.post(
  "/auth/register",
  h(async (q, s) => {
    const { email, password } = q.body;
    if (!/^\S+@\S+\.\S+$/.test(email || "") || (password || "").length < 6)
      throw fail(400, "Enter a valid email and a password of 6+ characters");
    const u = await User.create({
      email,
      password: await bcrypt.hash(password, 10),
      uid: crypto.randomBytes(3).toString("hex"),
    });
    s.status(201).json({
      token: sign(u),
      user: { email: u.email, uid: u.uid },
    });
  }),
);
r.post(
  "/auth/login",
  h(async (q, s) => {
    const u = await User.findOne({
      email: String(q.body.email || "").toLowerCase(),
    });
    if (!u || !(await bcrypt.compare(q.body.password || "", u.password)))
      throw fail(401, "Wrong email or password");
    s.json({ token: sign(u), user: { email: u.email, uid: u.uid } });
  }),
);

/* ---------- projects ---------- */
const owned = async (q) => {
  const p = await Project.findOne({ _id: q.params.id, owner: q.user.id });
  if (!p) throw fail(404, "Project not found");
  return p;
};

r.post(
  "/projects/suggest",
  auth,
  h(async (q, s) => {
    const names = await ai.suggestProjectNames(q.body.hint || "my links", 6);
    const taken = new Set(
      (await Project.find({ slug: { $in: names } }).select("slug")).map(
        (p) => p.slug,
      ), // * set is used for O(1) lookups of taken names .has later in the code
    );
    s.json({
      suggestions: names.map((n) => ({
        slug: n,
        available: !taken.has(n) && !RESERVED.includes(n),
      })),
    });
  }),
);

// finnaly create the project as choosen by user
r.post(
  "/projects",
  auth,
  h(async (q, s) => {
    const slug = clean(q.body.name);
    if (!slug || RESERVED.includes(slug))
      throw fail(400, "Choose another project name");
    const p = await Project.create({ owner: q.user.id, name: slug, slug });
    s.status(201).json(p);
  }),
);

r.get(
  "/projects",
  auth,
  h(async (q, s) => {
    const ps = await Project.find({ owner: q.user.id })
      .sort("-createdAt")
      .lean();
    const agg = await Link.aggregate([
      { $match: { owner: oid(q.user.id) } },
      {
        $group: {
          _id: "$project",
          links: { $sum: 1 },
          clicks: { $sum: "$clicks" },
        },
      },
    ]);
    const m = Object.fromEntries(agg.map((a) => [a._id, a]));
    // add links and clicks property in object
    s.json(
      ps.map((p) => ({
        ...p,
        links: m[p._id]?.links || 0,
        clicks: m[p._id]?.clicks || 0,
      })),
    );
  }),
);

r.delete(
  "/projects/:id",
  auth,
  h(async (q, s) => {
    const p = await owned(q);
    await Link.deleteMany({ project: p._id });
    await p.deleteOne();
    s.json({ ok: true });
  }),
);

/* ---------- links ---------- */
// Ask AI for a slug not yet used in this project; retry/regenerate on conflicts
async function uniqueSlug(project, url, avoid = []) {
  for (let i = 0; i < 3; i++) {
    const c = (await ai.suggestSlugs(url, 5, avoid)).filter(
      (x) => !avoid.includes(x),
    );
    const used = new Set(
      (await Link.find({ project, slug: { $in: c } }).select("slug")).map(
        (l) => l.slug,
      ),
    );
    const free = c.find((x) => !used.has(x));
    if (free) return free;
    avoid.push(...c);
  }
  return `${avoid[0] || "link"}-${crypto.randomBytes(2).toString("hex")}`;
}

// get all links in a project
r.get(
  "/projects/:id/links",
  auth,
  h(async (q, s) => {
    const p = await owned(q);
    const links = await Link.find({ project: p._id }).sort("-createdAt").lean();
    s.json({
      project: { id: p._id, slug: p.slug },
      links: links.map((l) => dto(l, p)),
    });
  }),
);
// suggest slugs for a URL in a project, based on the URL and optional theme
r.post(
  "/projects/:id/links/suggest",
  auth,
  h(async (q, s) => {
    const p = await owned(q);

    const url = validUrl(q.body.url);

    if (!url) {
      throw fail(400, "Enter a valid http(s) URL");
    }

    const slug = q.body.slug;

    const c = await ai.suggestSlugs(url, slug, 6);

    const used = new Set(
      (
        await Link.find({
          project: p._id,
          slug: { $in: c },
        }).select("slug")
      ).map((l) => l.slug),
    );

    s.json({
      suggestions: c.map((slug) => ({
        slug,
        available: !used.has(slug),
      })),
    });
  }),
);
// create a new link in a project
r.post(
  "/projects/:id/links",
  auth,
  h(async (q, s) => {
    const p = await owned(q);
    const url = validUrl(q.body.url);
    if (!url) throw fail(400, "Enter a valid http(s) URL");
    if (await Link.exists({ project: p._id, originalUrl: url }))
      throw fail(409, "This URL is already in the project");
    const slug = q.body.slug
      ? clean(q.body.slug)
      : await uniqueSlug(p._id, url);
    if (!slug) throw fail(400, "Invalid slug");
    if (await Link.exists({ project: p._id, slug }))
      throw fail(409, "That slug is already used in this project");
    const l = await Link.create({
      owner: q.user.id,
      project: p._id,
      originalUrl: url,
      slug,
    });
    s.status(201).json(dto(l, p));
  }),
);

// find project and link by id, ensuring the link belongs to the user
const mine = async (q) => {
  const l = await Link.findOne({ _id: q.params.id, owner: q.user.id });
  if (!l) throw fail(404, "Link not found");
  return [l, await Project.findById(l.project)];
};

// change the existing link's URL or slug, ensuring the new slug is unique in the project
r.put(
  "/links/:id",
  auth,
  h(async (q, s) => {
    const [l, p] = await mine(q);
    if (q.body.url) {
      const url = validUrl(q.body.url);
      if (!url) throw fail(400, "Enter a valid http(s) URL");
      l.originalUrl = url;
    }
    if (q.body.slug) {
      const slug = clean(q.body.slug);
      if (!slug) throw fail(400, "Invalid slug");
      if (slug !== l.slug && (await Link.exists({ project: p._id, slug })))
        throw fail(409, "That slug is already used in this project");
      l.slug = slug;
    }
    await l.save();
    s.json(dto(l, p));
  }),
);

r.post(
  "/links/:id/regenerate",
  auth,
  h(async (q, s) => {
    const [l, p] = await mine(q);
    l.slug = await uniqueSlug(p._id, l.originalUrl, [l.slug]);
    await l.save();
    s.json(dto(l, p));
  }),
);

r.delete(
  "/links/:id",
  auth,
  h(async (q, s) => {
    const [l] = await mine(q);
    await l.deleteOne();
    s.json({ ok: true });
  }),
);

/* ---------- dashboard ---------- */
r.get(
  "/stats",
  auth,
  h(async (q, s) => {
    const owner = oid(q.user.id);
    const since = new Date(Date.now() - 6 * 864e5);
    since.setUTCHours(0, 0, 0, 0);
    const [tot] = await Link.aggregate([
      { $match: { owner } },
      {
        $group: { _id: null, links: { $sum: 1 }, clicks: { $sum: "$clicks" } },// every link is counted as 1, and every click is summed up
      },
    ]);
    const days = await Link.aggregate([
      { $match: { owner } },
      { $unwind: "$clickLog" },
      { $match: { "clickLog.at": { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$clickLog.at" } },
          n: { $sum: 1 },
        },
      },
    ]);
    const map = Object.fromEntries(days.map((d) => [d._id, d.n]));
    const series = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(since.getTime() + i * 864e5)
        .toISOString()
        .slice(0, 10);
      return { day, clicks: map[day] || 0 };
    });
    const top = await Link.find({ owner })
      .sort("-clicks")
      .limit(5)
      .populate("project", "slug")// ? want slug of project
      .lean();
    s.json({
      projects: await Project.countDocuments({ owner }),
      links: tot?.links || 0,
      clicks: tot?.clicks || 0,
      series,
      top: top.map((l) => dto(l, l.project)),
    });
  }),
);

module.exports = r;

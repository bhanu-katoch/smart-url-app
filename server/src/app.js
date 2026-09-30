const express = require('express'), cors = require('cors');
const { Project, Link } = require('./models');
const app = express();
app.use(cors({ origin: "http://localhost:5173" }), express.json());
app.use('/api', require('./api'));

// Redirect + click tracking:  host.com/<project>/<slug>
app.get('/:project/:slug', async (q, s, next) => {
  try {
    const p = await Project.findOne({ slug: q.params.project.toLowerCase() }).select('_id');
    const l = p && await Link.findOneAndUpdate(
      { project: p._id, slug: q.params.slug.toLowerCase() },
      { $inc: { clicks: 1 }, $push: { clickLog: { $each: [{ at: new Date() }], $slice: -2000 } } });
    l ? s.redirect(l.originalUrl) : s.status(404).send('Link not found');
  } catch (e) { next(e); }
});

app.use((e, q, s, n) => {
  const code = e.status || (e.code === 11000 ? 409 : ['CastError', 'ValidationError'].includes(e.name) ? 400 : 500);
  if (code === 500) console.error(e);
  s.status(code).json({ error: code === 500 ? 'Server error' : e.code === 11000 ? 'Already exists. Try a different name or slug' : e.message });
});
module.exports = app;

const m = require("mongoose");
const { ObjectId } = m.Schema.Types;

const User = m.model(
  "User",
  new m.Schema(
    {
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      password: { type: String, required: true },
      uid: { type: String, unique: true }, // unique user identifier
    },
    { timestamps: true },
  ),
);

// Project name (slug) is globally unique -> host.com/<project>/<slug> can never clash
const Project = m.model(
  "Project",
  new m.Schema(
    {
      owner: { type: ObjectId, ref: "User", required: true, index: true },
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
    },
    { timestamps: true },
  ),
);

const linkSchema = new m.Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    project: { type: ObjectId, ref: "Project", required: true },
    originalUrl: { type: String, required: true },
    slug: { type: String, required: true },
    clicks: { type: Number, default: 0 },
    clickLog: [{ _id: false, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);
linkSchema.index({ project: 1, slug: 1 }, { unique: true }); // no duplicate slug in a project
linkSchema.index({ project: 1, originalUrl: 1 }, { unique: true }); // no duplicate URL in a project
const Link = m.model("Link", linkSchema);

module.exports = { User, Project, Link };

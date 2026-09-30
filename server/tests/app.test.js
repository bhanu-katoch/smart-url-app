process.env.JWT_SECRET = "test";
process.env.BASE_URL = "http://short.test";
jest.mock("../src/ai", () => ({
  ...jest.requireActual("../src/ai"),
  suggestSlugs: jest.fn(async () => ["ai-slug", "ai-slug-two"]),
  suggestProjectNames: jest.fn(async () => ["alpha", "beta"]),
}));
const request = require("supertest"),
  mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { Link } = require("../src/models");

let mongo, tokA, tokB, pid;
const reg = async (e) =>
  (
    await request(app)
      .post("/api/auth/register")
      .send({ email: e, password: "secret1" })
  ).body.token;
const A = () => ({ Authorization: "Bearer " + tokA }),
  B = () => ({ Authorization: "Bearer " + tokB });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  tokA = await reg("a@x.com");
  tokB = await reg("b@x.com");
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("auth", () => {
  test("rejects duplicate email and bad login", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ email: "a@x.com", password: "secret1" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "a@x.com", password: "nope" })
      ).status,
    ).toBe(401);
  });
  test("login works", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@x.com", password: "secret1" });
    expect(res.status).toBe(200); // change it to 201 for checking test fail
    expect(res.body.user.uid).toBeTruthy();
  });
  test("protected routes need a token", async () => {
    expect((await request(app).get("/api/projects")).status).toBe(401);
  });
});

describe("projects & links", () => {
  test("project names are globally unique", async () => {
    const r1 = await request(app)
      .post("/api/projects")
      .set(A())
      .send({ name: "Travel Blog" });
    expect(r1.status).toBe(201);
    expect(r1.body.slug).toBe("travel-blog");
    pid = r1.body._id;
    expect(
      (
        await request(app)
          .post("/api/projects")
          .set(B())
          .send({ name: "travel blog" })
      ).status,
    ).toBe(409);
  });
  test("creates AI-slug link, blocks duplicate URL, validates URL", async () => {
    const r1 = await request(app)
      .post(`/api/projects/${pid}/links`)
      .set(A())
      .send({ url: "https://example.com/a" });
    expect(r1.status).toBe(201);
    expect(r1.body.shortUrl).toBe("http://short.test/travel-blog/ai-slug");
    expect(
      (
        await request(app)
          .post(`/api/projects/${pid}/links`)
          .set(A())
          .send({ url: "https://example.com/a" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/projects/${pid}/links`)
          .set(A())
          .send({ url: "javascript:alert(1)" })
      ).status,
    ).toBe(400);
  });
  test("AI slug avoids conflicts for a second URL", async () => {
    const r = await request(app)
      .post(`/api/projects/${pid}/links`)
      .set(A())
      .send({ url: "https://example.com/b" });
    expect(r.body.slug).toBe("ai-slug-two");
  });
  test("redirect increments clicks", async () => {
    const res = await request(app).get("/travel-blog/ai-slug");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://example.com/a");
    expect((await Link.findOne({ slug: "ai-slug" })).clicks).toBe(1);
    expect((await request(app).get("/travel-blog/missing")).status).toBe(404);
  });
  test("update rejects taken slug; regenerate changes slug", async () => {
    const link = await Link.findOne({ slug: "ai-slug" });
    const put = await request(app)
      .put(`/api/links/${link.id}`)
      .set(A())
      .send({ slug: "ai-slug-two" });
    expect(put.status).toBe(409);
    const ok = await request(app)
      .put(`/api/links/${link.id}`)
      .set(A())
      .send({ slug: "My Custom" });
    expect(ok.body.slug).toBe("my-custom");
    const rg = await request(app)
      .post(`/api/links/${link.id}/regenerate`)
      .set(A());
    expect(rg.status).toBe(200);
    expect(rg.body.slug).toBe("ai-slug");
  });
  test("authorization: other users cannot touch my data", async () => {
    const link = await Link.findOne({ slug: "ai-slug" });
    expect(
      (await request(app).delete(`/api/links/${link.id}`).set(B())).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/projects/${pid}/links`).set(B())).status,
    ).toBe(404);
  });
  test("stats reflect clicks; delete works", async () => {
    const st = await request(app).get("/api/stats").set(A());
    expect(st.body.clicks).toBe(1);
    expect(st.body.series).toHaveLength(7);
    const link = await Link.findOne({ slug: "ai-slug-two" });
    expect(
      (await request(app).delete(`/api/links/${link.id}`).set(A())).status,
    ).toBe(200);
  });
});

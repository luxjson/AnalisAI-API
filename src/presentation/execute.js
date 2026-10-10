const { project } = require("../application/services/projections");

function execute(useCase) {
  return async (req, res, next) => {
    const messages = {};
    let value;
    let status = 200;
    let headers = {};
    let binary = false;
    const result = {
      code(n) {
        status = n;
        return this;
      },
      header(k, v) {
        headers[k] = v;
        return this;
      },
      data(data) {
        value = data;
        return data;
      },
      binary(data) {
        binary = true;
        value = data;
        return data;
      },
      complete(destination) {
        value = {
          success: !messages.error_msg,
          message:
            messages.error_msg?.join(" • ") ||
            messages.success_msg?.join(" • "),
          next: destination,
        };
        if (messages.error_msg) status = 400;
        return value;
      },
    };
    const context = {
      input: req.body || {},
      filters: req.query || {},
      ids: req.params || {},
      attachment: req.file,
      header: (name) => req.get(name),
      message(key, value) {
        if (value !== undefined) {
          (messages[key] ||= []).push(value);
          return messages[key];
        }
        return messages[key] || [];
      },
    };
    Object.defineProperty(context, "session", { get: () => req.session });
    try {
      await useCase(context, result);
      if (!req.session) {
        const config = require("./config");
        res.clearCookie(config.cookieName, {
          path: "/",
          secure: config.production,
          httpOnly: true,
          sameSite: "lax",
        });
      }
      if (req.session && (req.session.userId || req.session.aluno))
        await new Promise((resolve, reject) =>
          req.session.save((err) => (err ? reject(err) : resolve())),
        );
      if (!binary) {
        value = project(value);
        if (value === undefined) value = { success: true };
        if (value && !Array.isArray(value) && typeof value === "object") {
          value.csrfToken = req.session?.csrfToken;
          if (messages.error_msg?.length && status < 400) {
            status = 400;
            value.error = messages.error_msg.join(" • ");
          }
          for (const k of ["success_msg", "error_msg"])
            if (Array.isArray(value[k])) value[k] = value[k].join(" • ");
          if (messages.success_msg?.length)
            value.success_msg = messages.success_msg.join(" • ");
        }
        for (const [key, header] of Object.entries(headers))
          res.setHeader(key, header);
        return res.status(status).json(value);
      }
      for (const [key, header] of Object.entries(headers))
        res.setHeader(key, header);
      return res.status(status).send(value);
    } catch (err) {
      next(err);
    }
  };
}
module.exports = execute;

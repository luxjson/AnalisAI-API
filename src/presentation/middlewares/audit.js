const { record } = require("../../infrastructure/auditLog");
module.exports = function audit(req, res, next) {
  res.once("finish", () => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) && res.statusCode < 400)
      return;
    const student = req.session?.aluno;
    const kind = student
      ? "aluno"
      : req.session?.userId
        ? "professor"
        : req.identity?.kind;
    const id = student?.id || req.session?.userId || req.identity?.id;
    record({
      kind,
      id,
      method: req.method,
      resource: req.path,
      status: res.statusCode,
    }).catch(() =>
      console.error("Não foi possível registrar o evento de segurança."),
    );
  });
  next();
};

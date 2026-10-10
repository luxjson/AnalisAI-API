const limits = {
  nome: 100,
  titulo: 200,
  descricao: 5000,
  feedback: 5000,
  observacoes: 2000,
  message: 4000,
  resposta_texto: 10000,
  email: 100,
  usuario: 100,
  senha: 128,
  password: 128,
  nova_senha: 128,
  senha_atual: 128,
  confirmar_senha: 128,
  matricula: 50,
};
module.exports = function inputLimits(req, res, next) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.is("application/json") &&
    (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
  )
    return res.status(400).json({ error: "Envie um objeto JSON." });
  for (const [key, max] of Object.entries(limits)) {
    const value = req.body?.[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.length > max)
    )
      return res.status(400).json({
        error: `Campo ${key} inválido ou maior que o limite permitido.`,
      });
  }
  next();
};

const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
async function exportWorkbook(dataAlunos) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Relatório AnalisAI");
  worksheet.columns = [
    {
      key: "A",
      width: 10,
    },
    {
      key: "B",
      width: 20,
    },
    {
      key: "C",
      width: 20,
    },
    {
      key: "D",
      width: 24,
    },
    {
      key: "E",
      width: 12,
    },
    {
      key: "F",
      width: 12,
    },
    {
      key: "G",
      width: 25,
    },
    {
      key: "H",
      width: 120,
    },
  ];
  try {
    const arrayBuffer = fs.readFileSync(
      path.join(__dirname, "../../../assets/xls-logo.png"),
    );
    const logoId = workbook.addImage({
      buffer: arrayBuffer,
      extension: "png",
    });
    worksheet.addImage(logoId, {
      tl: {
        col: 0,
        row: 0,
      },
      br: {
        col: 3,
        row: 6,
      },
    });
    worksheet.mergeCells("D2:G4");
    const titleCell = worksheet.getCell("D2");
    titleCell.value = "RELATÓRIO GERAL DE DESEMPENHO POR COMPETÊNCIA";
    titleCell.font = {
      size: 16,
      bold: true,
      color: {
        argb: "FFFF0101",
      },
    };
    titleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  } catch (e) {
    console.log("Erro logo");
  }
  const headerRow = worksheet.getRow(8);
  headerRow.values = [
    "ID",
    "ALUNO",
    "ANO ESCOLAR",
    "IDADE",
    "MÉDIA",
    "PRESENÇA",
    "NÍVEL",
    "COMPETÊNCIAS",
  ];
  headerRow.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFFF0101",
      },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  });
  dataAlunos.forEach((aluno, index) => {
    let mediaCompetencias = 0;
    let competenciasStr = "";
    if (aluno.competencias && aluno.competencias.length > 0) {
      const soma = aluno.competencias.reduce(
        (acc, comp) => acc + parseFloat(comp.nota),
        0,
      );
      mediaCompetencias = (soma / aluno.competencias.length).toFixed(1);
      competenciasStr = aluno.competencias
        .map((comp) => `${comp.nome}: ${parseFloat(comp.nota).toFixed(1)}`)
        .join("; ");
    } else {
      mediaCompetencias = "0.0";
      competenciasStr = "Sem competências";
    }
    let nivel = "EM DESENVOLVIMENTO";
    if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
      nivel = "APTO";
    } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
      nivel = "INAPTO";
    }
    const row = worksheet.getRow(9 + index);
    row.values = [
      aluno.id,
      aluno.nome,
      aluno.ano_escolar,
      aluno.idade,
      mediaCompetencias,
      aluno.presenca + "%",
      nivel,
      competenciasStr,
    ];
    row.eachCell((cell, colNum) => {
      cell.alignment = {
        horizontal: colNum === 2 ? "left" : "center",
        vertical: "middle",
      };
    });
  });
  let currentRow = 9 + dataAlunos.length + 2;
  dataAlunos.forEach((aluno) => {
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value =
      `HISTÓRICO INDIVIDUAL: ${aluno.nome.toUpperCase()}`;
    titleRow.getCell(1).font = {
      bold: true,
      color: {
        argb: "FFFF0101",
      },
    };
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const compHeaderRow = worksheet.getRow(currentRow);
    compHeaderRow.getCell(2).value = "COMPETÊNCIAS";
    compHeaderRow.getCell(7).value = "NOTA";
    compHeaderRow.getCell(2).font = {
      bold: true,
    };
    compHeaderRow.getCell(7).font = {
      bold: true,
    };
    compHeaderRow.getCell(2).alignment = {
      horizontal: "left",
    };
    compHeaderRow.getCell(7).alignment = {
      horizontal: "center",
    };
    currentRow++;
    if (aluno.competencias && aluno.competencias.length > 0) {
      aluno.competencias.forEach((comp) => {
        const compRow = worksheet.getRow(currentRow);
        compRow.getCell(2).value = comp.nome;
        compRow.getCell(3).value = comp.observacoes || "Avaliação inicial";
        compRow.getCell(7).value = parseFloat(comp.nota).toFixed(1);
        compRow.getCell(2).alignment = {
          horizontal: "left",
        };
        compRow.getCell(3).alignment = {
          horizontal: "left",
        };
        compRow.getCell(7).alignment = {
          horizontal: "center",
        };
        compRow.getCell(7).font = {
          bold: true,
        };
        worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
        currentRow++;
      });
    } else {
      const emptyRow = worksheet.getRow(currentRow);
      emptyRow.getCell(2).value = "Sem competências";
      emptyRow.getCell(3).value = "-";
      emptyRow.getCell(7).value = "-";
      worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
      currentRow++;
    }
    currentRow += 2;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
module.exports = {
  exportWorkbook,
};

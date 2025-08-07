// src/servicios/apiMaxiRest.js

export const obtenerToken = async () => {
  const loginData = {
    email: "diegosebastianalbo@gmail.com",
    pass: "Mantenimiento2022",
    cod_cli: "14536",
  };

  const response = await fetch("https://api-mconn.maxisistemas.com.ar/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginData),
  });

  const data = await response.json();
  if (data.resultCode === "SUCCESS") {
    return data.content.tokenAccess;
  } else {
    throw new Error("Token inválido: " + data.resultDescription);
  }
};

export const obtenerArticulos = async (token, fechaInicio, fechaFin) => {
  const url = new URL("https://api-mconn.maxisistemas.com.ar/menuweb/menuextendido");
  if (fechaInicio) url.searchParams.append("fechaInicio", fechaInicio);
  if (fechaFin) url.searchParams.append("fechaFin", fechaFin);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (data.resultCode === "SUCCESS") {
    return data.content;
  } else {
    throw new Error("Error al obtener artículos: " + data.resultDescription);
  }
};

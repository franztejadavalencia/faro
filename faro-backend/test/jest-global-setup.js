// Los tests unitarios corren con el proceso en UTC (el peor caso para fechas):
// así "hoy" y el año tienen que salir de ZONA_HORARIA y no de la zona de la
// máquina. Se fija aquí porque globalSetup corre antes de crear los workers de
// jest, que heredan la variable; cambiar process.env.TZ dentro de un test no
// afecta al Date real.
module.exports = () => {
  process.env.TZ = 'UTC';
};

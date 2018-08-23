const alasql = require("alasql");
const puppeteer = require("puppeteer");
const http = require("http");

var options = {
  host: "www.amarillas.cl",
  port: 80,
  path: "/",
  scrapeUrl: "https://www.amarillas.cl"
};

async function scrape(buscar) {
  if (!verificarEntrada(buscar)) {
    process.exit()
  }
  if (!verificarAmarillas()) {
    process.exit()
  }

  console.log("👀   Buscando por " + buscar);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  // eliminar imagenes
  page.on("request", request => {
    if (request.resourceType() === "image") {
      request.abort();
    } else {
      request.continue();
    }
  });
  await page.goto(options.scrapeUrl);
  await page.type("input#keyword", buscar);
  await page.click("#buscar");

  let response = await verificarRespuesta(page)
  if (!response) {
    console.log("No encontramos nada 😓");
    process.exit()
    return;
  }

  // El selector de los avisos
  let sel = "li.business";

  await page.waitForSelector(sel);
  let clientesTotales = [];
  let next;
  let pagina = 1;
  // variables responsables de animación de carga
  let P = ["\\", "|", "/", "-"];
  let pindex = 0;

  do {
    // esperar a que sean visibles los li
    await page.waitForSelector(sel);
    // Tomar una captura de la última extracion
    await page.screenshot({ path: "screenshots/yellow.png", fullPage: true });
    let clientes = await page.evaluate(sel => {
      const links = Array.from(document.querySelectorAll(sel)).map(el => {
        let email = "No publica email";
        let data;
        let web = "No publica sitio web";
        Array.from(el.children).map(e => {
          // Extraer el link del sitio.
          if (e.querySelector("#Web") !== null) {
            web = e.querySelector("#Web").href;
          }
          // Extraer datos en tag script.
          if (e.tagName === "SCRIPT") {
            data = e.innerText;
          }
          // Extraer email de clase questionData.
          if (e.className === "questionData") {
            email = e.value;
          }
        });
        return { email: email, data: data, web: web };
      });
      return links;
    }, sel);

    clientes = clientes
      .filter(el => {
        return el.data !== undefined;
      })
      .map(el => {
        let str_json = el.data;
        str_json = str_json.substring(str_json.indexOf("["));
        str_json = str_json
          .replace(/'/gi, '"')
          .replace(/\\/gi, "\\")
          .replace(/":"/gi, '""')
          .replace(/:/gi, "")
          .replace(/;/gi, "")
          .trim();
        let data = JSON.parse(str_json);
        return {
          empresa: data[0],
          direccion: data[11] + " " + data[2],
          telefono: data[5],
          categoria: data[6],
          direccion_amarillas: data[7],
          id_amarillas: data[8],
          email: el.email,
          web: el.web
        };
      });

    clientesTotales.push.apply(clientesTotales, clientes);

    process.stdout.write(
      "\r Datos extraídos " +
        clientesTotales.length +
        " página nro " +
        pagina +
        " " +
        P[pindex++]
    );
    pindex = pindex % P.length;

    let nextLink = "li.last";
    next = await page.evaluate(nextLink => {
      return document.querySelector(nextLink);
    }, nextLink);

    if (next !== null) {
      await page.click(nextLink);
      await page.waitForSelector(sel);
      pagina++;
    }
  } while (next !== null);
  // exportar los clientes a excel ♥️
  await exporta_excel(buscar, clientesTotales);

  await browser.close();
}

// exportar arreglo de clientes a xlsx
async function exporta_excel(buscar, clientes) {
  console.log("\n Archivo exportado exitosamente 👏");
  alasql('SELECT * INTO XLSX("out/' + buscar + '.xlsx",{headers:true})FROM ?', [
    clientes
  ]);
}

function verificarEntrada(buscar) {
  if (buscar !== null && !buscar.toString()) {
    console.log("Favor de agregar la busqueda 🙌 ");
    return;
  }
  return true;
}

async function verificarAmarillas() {
  return await http
    .get(options, function(res) {
      if (res.statusCode == 200 || res.statusCode == 301) {
        return true;
      }
    })
    .on("error", function(e) {
      return false;
    });

  function testPort(port, host, cb) {
    http
      .get(
        {
          host: host,
          port: port
        },
        function(res) {
          cb("success", res);
        }
      )
      .on("error", function(e) {
        cb("failure", e);
      });
  }
}

async function verificarRespuesta(page) {
  // clase flag de resultados 
  let selBe = '.be'
  let sel = ".no-results-left";
  await page.waitForSelector(selBe);
  let result = await page.evaluate(sel => {
     return document.querySelector(sel) === null ?
      document.querySelector(sel) 
      :  document.querySelector(sel).className
  },sel);
  return result === null ? true : false;
}

let args = process.argv.slice(2);
scrape(args);

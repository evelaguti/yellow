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
  let sel = ".business";

  await page.waitForSelector(sel);
  
  
  let next;
  let pagina = 1;
  let clientesTotales = []
  // variables responsables de animación de carga
  let P = ["\\", "|", "/", "-"];
  let pindex = 0;

  do {
    
    // esperar a que sean visibles los li
    await page.waitForSelector(sel);
    // Tomar una captura de la última extracion
    await page.screenshot({ path: "screenshots/yellow.png", fullPage: true });
    
   let resultado = await page.evaluate(()=>{
      let clientes = [];
      let avisos = document.querySelectorAll('meta[itemprop=name]');
      avisos.forEach(function(aviso){
        let cliente = {}
        cliente.nombre = aviso.content;
        cliente.email = aviso.nextElementSibling.outerHTML.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
        cliente.fono = aviso.parentElement.outerHTML.match(/\(\+\d{2,4}\) \d \d{2,8} \d{2,8}/gi);
        let website = aviso.parentElement.querySelector('#Web');
        cliente.web = website != null ? website.href : '';
        clientes.push(cliente);
      })
      return clientes;
    });

    process.stdout.write(
      "\r Datos extraídos " +
        clientesTotales.length +
        " página nro " +
        pagina +
        " " +
        P[pindex++]
    );
    pindex = pindex % P.length;
    Array.prototype.push.apply(clientesTotales,resultado)

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
  //} while (resultado === null);
  // exportar los clientes a excel ♥️
  await exportExcel(buscar, clientesTotales);

  await browser.close();
}

// exportar arreglo de clientes a xlsx
async function exportExcel(buscar, clientes) {
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
  let selBe = '.business'
  let sel = ".business";
  await page.waitForSelector(selBe);
  let result = await page.evaluate(sel => {
     return document.querySelector(sel) === null ?
      document.querySelector(sel) 
      :  document.querySelector(sel).className
  },sel);
  return result === null ? false : true;
}

// Ejecutar el programa con los argumentos de la linea de comandos
let args = process.argv.slice(2);
scrape(args).catch(e => {
  console.log('Un error a ocurrido 😰 \n'+e )
  process.exit()
})


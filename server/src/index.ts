import app from "./server";
async function main() {
	await app.listen({port: 8000});
}

main();
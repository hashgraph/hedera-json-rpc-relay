import app from './server';

async function main() {
  await app.listen({ port: 7546 });
}

main();

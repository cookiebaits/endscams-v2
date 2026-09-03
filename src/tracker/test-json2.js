async function test() {
  const r2 = await fetch("https://scammer.info/c/scams.json", { headers: {'User-Agent': 'Mozilla/5.0'} });
  console.log("Scammer.info JSON status:", r2.status);
}
test();

async function test() {
  const r1 = await fetch("https://techscammersunited.com/latest", { headers: {'User-Agent': 'Mozilla/5.0'} });
  console.log("TSU status:", r1.status);
  const r2 = await fetch("https://scammer.info/c/scams", { headers: {'User-Agent': 'Mozilla/5.0'} });
  console.log("Scammer.info status:", r2.status);
}
test();

async function test() {
  const r1 = await fetch("https://techscammersunited.com/latest.json", { headers: {'User-Agent': 'Mozilla/5.0'} });
  console.log("TSU JSON status:", r1.status);
  const data1 = await r1.json();
  console.log("TSU JSON keys:", Object.keys(data1));
}
test();

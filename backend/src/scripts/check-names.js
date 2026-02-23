import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

console.log('═══ REGIONS ═══');
const regions = await db.collection('regions').find({}).project({ name: 1, code: 1, _id: 0 }).toArray();
console.log('Total:', regions.length);
let rMissingEn = 0, rMissingRu = 0, rMissingUz = 0;
for (const r of regions) {
  const issues = [];
  if (!r.name?.en) { issues.push('en'); rMissingEn++; }
  if (!r.name?.ru) { issues.push('ru'); rMissingRu++; }
  if (!r.name?.uz) { issues.push('uz'); rMissingUz++; }
  if (issues.length) console.log('  ⚠', JSON.stringify(r.name), 'code:', r.code, 'missing:', issues.join(','));
}
console.log('Missing en:', rMissingEn, '| ru:', rMissingRu, '| uz:', rMissingUz);

console.log('\n═══ DISTRICTS ═══');
const districts = await db.collection('districts').find({}).project({ name: 1, regionCode: 1, _id: 0 }).toArray();
console.log('Total:', districts.length);
let dMissingEn = 0, dMissingRu = 0, dMissingUz = 0;
const missingRu = [];
const missingEn = [];
for (const d of districts) {
  if (!d.name?.en) { dMissingEn++; missingEn.push(d); }
  if (!d.name?.ru) { dMissingRu++; missingRu.push(d); }
  if (!d.name?.uz) { dMissingUz++; }
}
console.log('Missing en:', dMissingEn, '| ru:', dMissingRu, '| uz:', dMissingUz);

if (missingRu.length) {
  console.log('\n── Missing ru ──');
  for (const d of missingRu) console.log('  ⚠', JSON.stringify(d.name), 'region:', d.regionCode);
}
if (missingEn.length) {
  console.log('\n── Missing en ──');
  for (const d of missingEn) console.log('  ⚠', JSON.stringify(d.name), 'region:', d.regionCode);
}

await mongoose.disconnect();
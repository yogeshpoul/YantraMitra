/** Initial catalogue. After seeding, admins manage it in the admin panel; the seed never overwrites their edits. */
import type { PrismaClient } from '../generated/prisma/client.js';

type Names = [en: string, mr: string, hi: string];
export interface SeedCategory {
  slug: string;
  icon: string;
  names: Names;
  types: { slug: string; icon?: string; names: Names }[];
}

export const CATEGORIES: SeedCategory[] = [
  {
    slug: 'tractors', icon: 'tractor', names: ['Tractors', 'ट्रॅक्टर', 'ट्रैक्टर'],
    types: [
      { slug: 'tractor', names: ['Tractor', 'ट्रॅक्टर', 'ट्रैक्टर'] },
      { slug: 'tractor-with-rotavator', icon: 'tillage', names: ['Tractor with rotavator', 'रोटाव्हेटरसह ट्रॅक्टर', 'रोटावेटर के साथ ट्रैक्टर'] },
      { slug: 'tractor-with-cultivator', icon: 'tillage', names: ['Tractor with cultivator', 'कल्टिव्हेटरसह ट्रॅक्टर', 'कल्टीवेटर के साथ ट्रैक्टर'] },
      { slug: 'tractor-with-trolley', icon: 'transport', names: ['Tractor with trolley', 'ट्रॉलीसह ट्रॅक्टर', 'ट्रॉली के साथ ट्रैक्टर'] },
      { slug: 'tractor-with-plough', icon: 'tillage', names: ['Tractor with plough', 'नांगरासह ट्रॅक्टर', 'हल के साथ ट्रैक्टर'] },
    ],
  },
  {
    slug: 'tillage', icon: 'tillage', names: ['Tillage equipment', 'मशागत अवजारे', 'जुताई उपकरण'],
    types: [
      { slug: 'rotavator', names: ['Rotavator', 'रोटाव्हेटर', 'रोटावेटर'] },
      { slug: 'cultivator', names: ['Cultivator', 'कल्टिव्हेटर', 'कल्टीवेटर'] },
      { slug: 'disc-harrow', names: ['Disc harrow', 'डिस्क हॅरो', 'डिस्क हैरो'] },
      { slug: 'plough', names: ['Plough', 'नांगर', 'हल'] },
    ],
  },
  {
    slug: 'sowing', icon: 'sowing', names: ['Sowing equipment', 'पेरणी अवजारे', 'बुवाई उपकरण'],
    types: [
      { slug: 'seed-drill', names: ['Seed drill', 'पेरणी यंत्र', 'सीड ड्रिल'] },
      { slug: 'planter', names: ['Planter', 'प्लांटर', 'प्लांटर'] },
      { slug: 'transplanter', names: ['Transplanter', 'भात लावणी यंत्र', 'रोपाई यंत्र'] },
    ],
  },
  {
    slug: 'spraying', icon: 'spraying', names: ['Spraying equipment', 'फवारणी अवजारे', 'छिड़काव उपकरण'],
    types: [
      { slug: 'agricultural-drone', icon: 'drone', names: ['Agricultural drone', 'कृषी ड्रोन', 'कृषि ड्रोन'] },
      { slug: 'boom-sprayer', names: ['Boom sprayer', 'बूम स्प्रेयर', 'बूम स्प्रेयर'] },
      { slug: 'power-sprayer', names: ['Power sprayer', 'पॉवर स्प्रेयर', 'पावर स्प्रेयर'] },
    ],
  },
  {
    slug: 'harvesting', icon: 'harvesting', names: ['Harvesting equipment', 'कापणी अवजारे', 'कटाई उपकरण'],
    types: [
      { slug: 'combine-harvester', names: ['Combine harvester', 'कंबाईन हार्वेस्टर', 'कंबाइन हार्वेस्टर'] },
      { slug: 'reaper', names: ['Reaper', 'रीपर', 'रीपर'] },
      { slug: 'thresher', names: ['Thresher', 'मळणी यंत्र', 'थ्रेशर'] },
    ],
  },
  {
    slug: 'construction', icon: 'excavation', names: ['Excavation and construction', 'खोदकाम व बांधकाम', 'खुदाई और निर्माण'],
    types: [
      { slug: 'jcb', names: ['JCB (backhoe loader)', 'जेसीबी', 'जेसीबी'] },
      { slug: 'excavator', names: ['Excavator', 'एक्स्कॅव्हेटर', 'एक्सकेवेटर'] },
    ],
  },
  {
    slug: 'transportation', icon: 'transport', names: ['Transportation', 'वाहतूक', 'परिवहन'],
    types: [
      { slug: 'tractor-trolley', names: ['Tractor trolley', 'ट्रॅक्टर ट्रॉली', 'ट्रैक्टर ट्रॉली'] },
      { slug: 'trailer', names: ['Trailer', 'ट्रेलर', 'ट्रेलर'] },
    ],
  },
  {
    slug: 'irrigation', icon: 'irrigation', names: ['Irrigation', 'सिंचन', 'सिंचाई'],
    types: [
      { slug: 'water-pump', names: ['Water pump', 'पाण्याचा पंप', 'पानी का पंप'] },
      { slug: 'irrigation-motor', names: ['Irrigation motor', 'सिंचन मोटर', 'सिंचाई मोटर'] },
    ],
  },
  {
    slug: 'land-levelling', icon: 'levelling', names: ['Land levelling', 'जमीन सपाटीकरण', 'भूमि समतलीकरण'],
    types: [
      { slug: 'land-leveller', names: ['Land leveller', 'लँड लेव्हलर', 'लैंड लेवलर'] },
      { slug: 'laser-land-leveller', names: ['Laser land leveller', 'लेसर लँड लेव्हलर', 'लेज़र लैंड लेवलर'] },
    ],
  },
  {
    slug: 'other-machinery', icon: 'other', names: ['Other agricultural machinery', 'इतर कृषी यंत्रे', 'अन्य कृषि मशीनरी'],
    types: [{ slug: 'other-machine', names: ['Other machine', 'इतर यंत्र', 'अन्य मशीन'] }],
  },
];

export const OPERATIONS: { slug: string; names: Names }[] = [
  { slug: 'ploughing', names: ['Ploughing', 'नांगरणी', 'जुताई (हल)'] },
  { slug: 'rotavating', names: ['Rotavating', 'रोटाव्हेटर मारणे', 'रोटावेटर चलाना'] },
  { slug: 'cultivation', names: ['Cultivation', 'कुळवणी', 'कल्टीवेशन'] },
  { slug: 'seed-sowing', names: ['Seed sowing', 'पेरणी', 'बीज बुवाई'] },
  { slug: 'paddy-transplantation', names: ['Paddy transplantation', 'भात लावणी', 'धान रोपाई'] },
  { slug: 'spraying', names: ['Spraying', 'फवारणी', 'छिड़काव'] },
  { slug: 'fertilizer-application', names: ['Fertilizer application', 'खत देणे', 'खाद डालना'] },
  { slug: 'harvesting', names: ['Harvesting', 'कापणी', 'कटाई'] },
  { slug: 'threshing', names: ['Threshing', 'मळणी', 'गहाई'] },
  { slug: 'land-levelling', names: ['Land levelling', 'जमीन सपाटीकरण', 'भूमि समतलीकरण'] },
  { slug: 'excavation', names: ['Excavation', 'खोदकाम', 'खुदाई'] },
  { slug: 'transportation', names: ['Transportation', 'वाहतूक', 'ढुलाई'] },
  { slug: 'irrigation', names: ['Irrigation', 'सिंचन', 'सिंचाई'] },
];

/** Inserts missing entries; existing rows are left exactly as admins edited them. */
export async function seedCatalogue(db: PrismaClient): Promise<void> {
  for (const [ci, c] of CATEGORIES.entries()) {
    const [nameEn, nameMr, nameHi] = c.names;
    const category = await db.equipmentCategory.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, nameEn, nameMr, nameHi, iconKey: c.icon, sortOrder: (ci + 1) * 10 },
      update: {},
    });
    for (const [ti, t] of c.types.entries()) {
      const [en, mr, hi] = t.names;
      await db.equipmentType.upsert({
        where: { slug: t.slug },
        create: { slug: t.slug, categoryId: category.id, nameEn: en, nameMr: mr, nameHi: hi, iconKey: t.icon ?? null, sortOrder: (ti + 1) * 10 },
        update: {},
      });
    }
  }
  for (const [oi, o] of OPERATIONS.entries()) {
    const [nameEn, nameMr, nameHi] = o.names;
    await db.operation.upsert({ where: { slug: o.slug }, create: { slug: o.slug, nameEn, nameMr, nameHi, sortOrder: (oi + 1) * 10 }, update: {} });
  }
}

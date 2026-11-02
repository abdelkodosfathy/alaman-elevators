// Demo catalog. Prices are indicative EGP figures meant to be tuned from the admin panel.
import { InputType, PriceType, PrismaClient, ProductKind, RuleType } from '@prisma/client';

const prisma = new PrismaClient();

type O = [code: string, labelAr: string, labelEn: string, price: number, extra?: Partial<OptionSeed>];
interface OptionSeed {
  descriptionAr: string;
  swatch: string;
  priceType: PriceType;
  unitAttributeKey: string;
  isDefault: boolean;
}
interface AttrSeed {
  key: string;
  labelAr: string;
  labelEn: string;
  helpAr?: string;
  inputType: InputType;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
  unitAr?: string;
  includedUnits?: number;
  unitPrice?: number;
  options?: O[];
}
interface StepSeed {
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  attributes: AttrSeed[];
}
interface ProductSeed {
  slug: string;
  kind: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  basePrice: number;
  sortOrder: number;
  prefix: string;
  steps: StepSeed[];
  rules: [RuleType, string, string, string?][];
}

const single = (key: string, labelAr: string, labelEn: string, options: O[], helpAr?: string): AttrSeed => ({
  key, labelAr, labelEn, helpAr, inputType: 'SINGLE', options,
});
const multi = (key: string, labelAr: string, labelEn: string, options: O[], helpAr?: string): AttrSeed => ({
  key, labelAr, labelEn, helpAr, inputType: 'MULTI', required: false, options,
});
const def = { isDefault: true };

const elevator: ProductSeed = {
  slug: 'passenger-elevator',
  kind: 'ELEVATOR',
  nameAr: 'مصعد ركاب',
  nameEn: 'Passenger Elevator',
  descriptionAr: 'صمّم مصعدك من نوع الاستخدام والماكينة حتى التشطيبات الداخلية وأنظمة الأمان.',
  basePrice: 520_000,
  sortOrder: 1,
  prefix: 'elv',
  steps: [
    {
      key: 'building', titleAr: 'المبنى والاستخدام', titleEn: 'Building',
      descriptionAr: 'نوع المبنى وعدد الأدوار يحددان المواصفات الفنية المناسبة.',
      attributes: [
        single('usage', 'نوع الاستخدام', 'Usage', [
          ['residential', 'سكني', 'Residential', 0, { ...def, descriptionAr: 'للعمارات والأبراج السكنية' }],
          ['villa', 'فيلا / VIP', 'Villa / VIP', 60_000, { descriptionAr: 'كابينة فاخرة للفلل والمنازل الخاصة' }],
          ['commercial', 'تجاري / إداري', 'Commercial', 90_000, { descriptionAr: 'مولات ومباني إدارية بخدمة كثيفة' }],
          ['hospital', 'مستشفى', 'Hospital (bed)', 180_000, { descriptionAr: 'كابينة عميقة لنقل الأسرّة' }],
          ['freight', 'بضائع', 'Freight', 120_000, { descriptionAr: 'لنقل البضائع والأحمال الثقيلة' }],
        ]),
        { key: 'stops', labelAr: 'عدد الوقفات (الأدوار)', labelEn: 'Stops', inputType: 'NUMBER', min: 2, max: 30, defaultValue: 5, unitAr: 'وقفة', includedUnits: 2, unitPrice: 42_000, helpAr: 'السعر الأساسي يشمل وقفتين، وكل وقفة إضافية تُحسب منفصلة.' },
      ],
    },
    {
      key: 'machine', titleAr: 'الماكينة والأداء', titleEn: 'Machine',
      descriptionAr: 'قلب المصعد: نوع الماكينة والحمولة والسرعة.',
      attributes: [
        single('drive', 'نوع الماكينة', 'Drive', [
          ['gearless-mrl', 'جيرليس بدون غرفة ماكينة (MRL)', 'Gearless MRL', 85_000, { ...def, descriptionAr: 'موفرة للطاقة والمساحة، لا تحتاج غرفة علوية' }],
          ['gearless-mr', 'جيرليس بغرفة ماكينة', 'Gearless with machine room', 60_000, { descriptionAr: 'هادئة وعالية الكفاءة' }],
          ['geared', 'ماكينة جير تقليدية', 'Geared traction', 0, { descriptionAr: 'الحل الاقتصادي المجرّب' }],
          ['hydraulic', 'هيدروليك', 'Hydraulic', 70_000, { descriptionAr: 'مثالي للفلل والأماكن بدون بئر عميق' }],
        ]),
        single('origin', 'منشأ الماكينة', 'Machine origin', [
          ['turkish', 'تركي', 'Turkish', 0, def],
          ['italian', 'إيطالي', 'Italian', 75_000],
          ['german', 'ألماني', 'German', 140_000],
        ]),
        single('capacity', 'الحمولة', 'Capacity', [
          ['320', '320 كجم · 4 أشخاص', '320 kg · 4 persons', 0],
          ['450', '450 كجم · 6 أشخاص', '450 kg · 6 persons', 25_000, def],
          ['630', '630 كجم · 8 أشخاص', '630 kg · 8 persons', 55_000],
          ['800', '800 كجم · 10 أشخاص', '800 kg · 10 persons', 90_000],
          ['1000', '1000 كجم · 13 شخص', '1000 kg · 13 persons', 130_000],
          ['1600', '1600 كجم · 21 شخص / نقالة', '1600 kg · 21 persons / bed', 210_000],
        ]),
        single('speed', 'السرعة', 'Speed', [
          ['0.6', '0.6 م/ث', '0.6 m/s', 0],
          ['1.0', '1.0 م/ث', '1.0 m/s', 20_000, def],
          ['1.6', '1.6 م/ث', '1.6 m/s', 65_000],
          ['2.0', '2.0 م/ث', '2.0 m/s', 120_000],
        ], 'السرعات الأعلى مناسبة للمباني من 10 أدوار فأكثر.'),
        single('control', 'لوحة الكنترول', 'Controller', [
          ['inverter', 'كنترول ميكروبروسيسور + إنفرتر VVVF', 'Microprocessor + VVVF inverter', 0, { ...def, descriptionAr: 'بدء وتوقف ناعم بدون اهتزاز' }],
          ['smart', 'كنترول ذكي مع مراقبة عن بُعد', 'Smart controller with remote monitoring', 55_000, { descriptionAr: 'تنبيهات أعطال وتقارير تشغيل على الموبايل' }],
        ]),
      ],
    },
    {
      key: 'cabin', titleAr: 'تصميم الكابينة', titleEn: 'Cabin',
      descriptionAr: 'اختر خامات الحوائط والسقف والأرضية والإكسسوارات.',
      attributes: [
        single('walls', 'خامة الحوائط', 'Walls', [
          ['ss-std', 'ستانلس ستيل ساتان', 'Satin stainless', 0, { ...def, swatch: '#a7adb3' }],
          ['ss-hairline', 'ستانلس Hairline', 'Hairline stainless', 18_000, { swatch: '#c3c8cd' }],
          ['ss-mirror-gold', 'ستانلس مرآة ذهبي', 'Gold mirror stainless', 55_000, { swatch: '#c9a227' }],
          ['ss-black', 'ستانلس أسود تيتانيوم', 'Black titanium', 48_000, { swatch: '#26272b' }],
          ['wood', 'لامينيت خشبي', 'Wood laminate', 22_000, { swatch: '#8a6a4a' }],
          ['glass', 'زجاج بانوراما', 'Panoramic glass', 95_000, { swatch: '#9fc9d9', descriptionAr: 'حائط زجاجي للفلل والمولات' }],
        ]),
        single('ceiling', 'السقف والإضاءة', 'Ceiling', [
          ['led-panel', 'سقف ستانلس بإضاءة LED', 'LED panel', 0, def],
          ['mirror-led', 'سقف مرآة مع سبوتات LED', 'Mirror with spots', 14_000],
          ['backlit', 'سقف أكريليك بإضاءة خلفية', 'Backlit acrylic', 22_000],
          ['crystal', 'سقف كريستال فاخر', 'Crystal ceiling', 38_000],
        ]),
        single('floor', 'الأرضية', 'Floor', [
          ['pvc', 'PVC مقاوم للاحتكاك', 'PVC', 0, def],
          ['granite', 'جرانيت', 'Granite', 12_000],
          ['marble', 'رخام', 'Marble', 18_000],
        ]),
        single('handrail', 'الدرابزين', 'Handrail', [
          ['none', 'بدون', 'None', 0],
          ['ss', 'ستانلس مستدير', 'Round stainless', 6_000, def],
          ['gold', 'ذهبي', 'Gold', 11_000],
        ]),
        single('mirror', 'المرآة', 'Mirror', [
          ['none', 'بدون', 'None', 0],
          ['half', 'نصف حائط خلفي', 'Half wall', 7_000, def],
          ['full', 'حائط خلفي كامل', 'Full wall', 13_000],
        ]),
      ],
    },
    {
      key: 'doors', titleAr: 'الأبواب', titleEn: 'Doors',
      descriptionAr: 'باب الكابينة وأبواب الأدوار؛ تُحسب أبواب الأدوار لكل وقفة.',
      attributes: [
        single('door-type', 'نظام فتح الباب', 'Door operation', [
          ['auto-center', 'أوتوماتيك فتح من المنتصف', 'Automatic center opening', 0, def],
          ['auto-side', 'أوتوماتيك تلسكوبي جانبي', 'Automatic telescopic', 12_000],
          ['semi-auto', 'نصف أوتوماتيك', 'Semi-automatic', -25_000, { descriptionAr: 'باب كابينة أوتوماتيك وأبواب أدوار يدوية' }],
        ]),
        single('landing-finish', 'تشطيب أبواب الأدوار', 'Landing doors finish', [
          ['painted', 'صاج مدهون', 'Painted steel', 9_000, { priceType: 'PER_UNIT', unitAttributeKey: 'stops' }],
          ['ss', 'ستانلس ستيل', 'Stainless steel', 14_000, { ...def, priceType: 'PER_UNIT', unitAttributeKey: 'stops' }],
          ['ss-gold', 'ستانلس ذهبي', 'Gold stainless', 22_000, { priceType: 'PER_UNIT', unitAttributeKey: 'stops' }],
          ['glass', 'زجاج بإطار ستانلس', 'Framed glass', 28_000, { priceType: 'PER_UNIT', unitAttributeKey: 'stops' }],
        ], 'السعر لكل وقفة.'),
      ],
    },
    {
      key: 'controls', titleAr: 'لوحات التشغيل', titleEn: 'Fixtures',
      attributes: [
        single('cop', 'لوحة الكابينة (COP)', 'Car operating panel', [
          ['lcd', 'شاشة LCD مع أزرار ستانلس', 'LCD + stainless buttons', 0, def],
          ['tft', 'شاشة TFT ملونة 10 بوصة', '10" TFT display', 16_000],
          ['touch', 'لوحة لمس زجاجية', 'Glass touch panel', 32_000],
        ]),
        single('lop', 'لوحات الأدوار (LOP)', 'Landing panels', [
          ['std', 'أزرار مع مبيّن رقمي', 'Buttons + digital indicator', 0, def],
          ['tft', 'شاشة TFT لكل دور', 'TFT per floor', 3_500, { priceType: 'PER_UNIT', unitAttributeKey: 'stops' }],
        ]),
      ],
    },
    {
      key: 'safety', titleAr: 'الأمان والإضافات', titleEn: 'Safety & extras',
      descriptionAr: 'أنظمة الأمان والرفاهية الإضافية.',
      attributes: [
        multi('extras', 'إضافات', 'Extras', [
          ['ard', 'نظام الطوارئ ARD (هبوط لأقرب دور عند انقطاع الكهرباء)', 'Automatic rescue device', 28_000, { isDefault: true }],
          ['light-curtain', 'ستارة ضوئية لحماية الباب', 'Door light curtain', 9_000, { isDefault: true }],
          ['intercom', 'إنتركم 5 اتجاهات', '5-way intercom', 7_500],
          ['overload', 'حساس زيادة الحمولة', 'Overload sensor', 5_000],
          ['camera', 'كاميرا مراقبة داخل الكابينة', 'CCTV camera', 8_000],
          ['voice', 'إعلان صوتي للأدوار', 'Voice announcer', 4_500],
          ['fan', 'مروحة تهوية', 'Ventilation fan', 3_500],
          ['ac', 'تكييف للكابينة', 'Cabin AC', 45_000],
          ['card', 'تشغيل بالكارت (تحكم في الأدوار)', 'Access card control', 14_000],
          ['fire', 'وضع الحريق ورجال الإطفاء', 'Fire service mode', 12_000],
        ]),
      ],
    },
    {
      key: 'service', titleAr: 'الضمان والصيانة', titleEn: 'Warranty',
      attributes: [
        single('warranty', 'الضمان والصيانة المجانية', 'Warranty', [
          ['1y', 'سنة واحدة', '1 year', 0, def],
          ['2y', 'سنتين', '2 years', 4, { priceType: 'PERCENT' }],
          ['3y', '3 سنوات', '3 years', 7, { priceType: 'PERCENT' }],
        ], 'يشمل الصيانة الدورية وقطع الغيار الأصلية.'),
      ],
    },
  ],
  rules: [
    ['EXCLUDES', 'drive.hydraulic', 'speed.1.6', 'الماكينة الهيدروليك تعمل حتى سرعة 1.0 م/ث'],
    ['EXCLUDES', 'drive.hydraulic', 'speed.2.0', 'الماكينة الهيدروليك تعمل حتى سرعة 1.0 م/ث'],
    ['EXCLUDES', 'usage.hospital', 'capacity.320', 'مصعد المستشفى يحتاج حمولة 1000 كجم على الأقل'],
    ['EXCLUDES', 'usage.hospital', 'capacity.450', 'مصعد المستشفى يحتاج حمولة 1000 كجم على الأقل'],
    ['EXCLUDES', 'usage.hospital', 'capacity.630', 'مصعد المستشفى يحتاج حمولة 1000 كجم على الأقل'],
    ['EXCLUDES', 'usage.hospital', 'capacity.800', 'مصعد المستشفى يحتاج حمولة 1000 كجم على الأقل'],
    ['EXCLUDES', 'usage.freight', 'walls.glass', 'الحوائط الزجاجية غير مناسبة لمصاعد البضائع'],
    ['REQUIRES', 'speed.2.0', 'control.smart', 'سرعة 2.0 م/ث تتطلب الكنترول الذكي'],
  ],
};

const escalator: ProductSeed = {
  slug: 'escalator',
  kind: 'ESCALATOR',
  nameAr: 'سلم متحرك',
  nameEn: 'Escalator',
  descriptionAr: 'سلالم متحركة وممرات مشاة للمولات والمباني التجارية والمحطات.',
  basePrice: 2_100_000,
  sortOrder: 2,
  prefix: 'esc',
  steps: [
    {
      key: 'type', titleAr: 'النوع والاستخدام', titleEn: 'Type',
      attributes: [
        single('model', 'النوع', 'Type', [
          ['commercial', 'سلم متحرك تجاري (داخلي)', 'Commercial indoor escalator', 0, { ...def, descriptionAr: 'للمولات والمحلات والمباني الإدارية' }],
          ['heavy', 'سلم متحرك للخدمة الشاقة', 'Heavy-duty / public transport', 650_000, { descriptionAr: 'للمحطات والمطارات بتشغيل 20 ساعة يومياً' }],
          ['walkway', 'ممر مشاة متحرك', 'Moving walkway', 450_000, { descriptionAr: 'للهايبر ماركت والمطارات، يناسب عربات التسوق' }],
        ]),
        single('location', 'مكان التركيب', 'Location', [
          ['indoor', 'داخلي', 'Indoor', 0, def],
          ['semi', 'شبه خارجي (مغطى)', 'Semi-outdoor', 140_000],
          ['outdoor', 'خارجي بالكامل', 'Outdoor', 320_000, { descriptionAr: 'حماية من المياه والأتربة وتسخين للدرجات' }],
        ]),
      ],
    },
    {
      key: 'dimensions', titleAr: 'الأبعاد', titleEn: 'Dimensions',
      descriptionAr: 'الارتفاع بين الدورين وعرض الدرجة وزاوية الميل.',
      attributes: [
        { key: 'rise', labelAr: 'الارتفاع بين الدورين', labelEn: 'Rise', inputType: 'NUMBER', min: 3, max: 12, defaultValue: 5, unitAr: 'متر', includedUnits: 4, unitPrice: 165_000, helpAr: 'السعر الأساسي يشمل ارتفاع حتى 4 متر.' },
        single('width', 'عرض الدرجة', 'Step width', [
          ['600', '600 مم (شخص واحد)', '600 mm', 0],
          ['800', '800 مم', '800 mm', 120_000],
          ['1000', '1000 مم (شخصين)', '1000 mm', 230_000, def],
        ]),
        single('incline', 'زاوية الميل', 'Inclination', [
          ['30', '30°', '30°', 0, { ...def, descriptionAr: 'الأكثر راحة وأماناً' }],
          ['35', '35°', '35°', -60_000, { descriptionAr: 'توفر مساحة أرضية، حتى ارتفاع 6 متر' }],
          ['12', '12° (للممرات)', '12° (walkway)', 0],
        ]),
      ],
    },
    {
      key: 'design', titleAr: 'التصميم والتشطيب', titleEn: 'Design',
      attributes: [
        single('balustrade', 'الدرابزين الجانبي', 'Balustrade', [
          ['glass', 'زجاج سيكوريت شفاف', 'Clear tempered glass', 0, def],
          ['glass-led', 'زجاج مع إضاءة LED', 'Glass with LED lighting', 85_000],
          ['ss', 'ستانلس ستيل', 'Stainless panels', 40_000],
        ]),
        single('handrail', 'لون المسند المتحرك', 'Handrail color', [
          ['black', 'أسود', 'Black', 0, { ...def, swatch: '#1b1b1b' }],
          ['red', 'أحمر', 'Red', 18_000, { swatch: '#a32020' }],
          ['blue', 'أزرق', 'Blue', 18_000, { swatch: '#1f4e9a' }],
        ]),
        single('steps-finish', 'خامة الدرجات', 'Step finish', [
          ['alu', 'ألومنيوم طبيعي', 'Natural aluminium', 0, def],
          ['alu-yellow', 'ألومنيوم بحدود صفراء', 'Aluminium with yellow demarcation', 35_000],
          ['ss', 'ستانلس ستيل', 'Stainless steel', 120_000],
        ]),
        single('cladding', 'تكسية الجوانب الخارجية', 'Side cladding', [
          ['painted', 'صاج مدهون', 'Painted steel', 0, def],
          ['ss', 'ستانلس Hairline', 'Hairline stainless', 95_000],
          ['glass', 'زجاج (تصميم مفتوح)', 'Glass', 160_000],
        ]),
      ],
    },
    {
      key: 'features', titleAr: 'التشغيل والأمان', titleEn: 'Features',
      attributes: [
        single('origin', 'منشأ الوحدة', 'Origin', [
          ['chinese', 'صيني (فئة أولى)', 'Chinese (tier 1)', 0, def],
          ['italian', 'إيطالي', 'Italian', 380_000],
          ['german', 'ألماني', 'German', 720_000],
        ]),
        multi('extras', 'إضافات', 'Extras', [
          ['vvvf', 'إنفرتر VVVF لتوفير الطاقة', 'VVVF energy saving', 95_000, { isDefault: true }],
          ['auto-start', 'تشغيل تلقائي بالحساسات', 'Auto start/stop sensors', 45_000],
          ['comb-light', 'إضاءة مناطق الدخول والخروج', 'Comb plate lighting', 18_000, { isDefault: true }],
          ['skirt-brush', 'فرش أمان جانبية', 'Skirt deflector brushes', 26_000],
          ['step-light', 'إضاءة بين الدرجات', 'Step gap lighting', 22_000],
          ['handrail-uv', 'تعقيم المسند بالأشعة فوق البنفسجية', 'UV handrail sterilizer', 38_000],
          ['remote', 'مراقبة وتشخيص أعطال عن بُعد', 'Remote monitoring', 60_000],
        ]),
      ],
    },
    {
      key: 'service', titleAr: 'الضمان والصيانة', titleEn: 'Warranty',
      attributes: [
        single('warranty', 'الضمان والصيانة المجانية', 'Warranty', [
          ['1y', 'سنة واحدة', '1 year', 0, def],
          ['2y', 'سنتين', '2 years', 3, { priceType: 'PERCENT' }],
          ['3y', '3 سنوات', '3 years', 5, { priceType: 'PERCENT' }],
        ]),
      ],
    },
  ],
  rules: [
    ['EXCLUDES', 'model.walkway', 'incline.30', 'الممر المتحرك يعمل بزاوية 12°'],
    ['EXCLUDES', 'model.walkway', 'incline.35', 'الممر المتحرك يعمل بزاوية 12°'],
    ['EXCLUDES', 'model.commercial', 'incline.12', 'زاوية 12° للممرات المتحركة فقط'],
    ['EXCLUDES', 'model.heavy', 'incline.12', 'زاوية 12° للممرات المتحركة فقط'],
    ['EXCLUDES', 'model.heavy', 'incline.35', 'سلالم الخدمة الشاقة تعمل بزاوية 30°'],
    ['EXCLUDES', 'model.heavy', 'width.600', 'سلالم الخدمة الشاقة تتطلب عرض 800 مم على الأقل'],
  ],
};

async function seedProduct(p: ProductSeed) {
  await prisma.product.deleteMany({ where: { slug: p.slug } });
  const product = await prisma.product.create({
    data: { slug: p.slug, kind: p.kind, nameAr: p.nameAr, nameEn: p.nameEn, descriptionAr: p.descriptionAr, basePrice: p.basePrice, sortOrder: p.sortOrder },
  });
  const ids = new Map<string, string>();
  for (const [si, s] of p.steps.entries()) {
    const step = await prisma.step.create({
      data: { productId: product.id, key: s.key, titleAr: s.titleAr, titleEn: s.titleEn, descriptionAr: s.descriptionAr, sortOrder: si },
    });
    for (const [ai, a] of s.attributes.entries()) {
      const { options = [], ...attr } = a;
      const created = await prisma.attribute.create({ data: { ...attr, stepId: step.id, productId: product.id, sortOrder: ai } });
      for (const [oi, [code, labelAr, labelEn, price, extra]] of options.entries()) {
        const full = `${p.prefix}.${a.key}.${code}`;
        const opt = await prisma.option.create({
          data: { attributeId: created.id, code: full, labelAr, labelEn, price, sortOrder: oi, ...extra },
        });
        ids.set(`${a.key}.${code}`, opt.id);
      }
    }
  }
  for (const [type, from, to, messageAr] of p.rules) {
    const optionId = ids.get(from);
    const targetId = ids.get(to);
    if (!optionId || !targetId) throw new Error(`Unknown rule option ${from} -> ${to}`);
    await prisma.optionRule.create({ data: { type, optionId, targetId, messageAr } });
  }
  console.log(`Seeded ${p.slug}: ${ids.size} options, ${p.rules.length} rules`);
}

async function main() {
  // Quotes reference products, so clear demo quotes before reseeding the catalog.
  await prisma.quote.deleteMany({ where: { product: { slug: { in: [elevator.slug, escalator.slug] } } } });
  await seedProduct(elevator);
  await seedProduct(escalator);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

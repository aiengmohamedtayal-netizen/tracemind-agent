# TraceMind

<p align="center">
  <strong>منصة لتحليل سجلات الأحداث واكتشاف السلوك غير الطبيعي ودعم التحقيق الفني.</strong>
</p>

<p align="center">
  حل تعليمي يجمع بين تحليل البيانات، واكتشاف الشذوذ، والتحسين باستخدام Binary PSO، والتوصيات المعتمدة على الأدلة.
</p>

---

## نبذة عن المشروع

**TraceMind** تطبيق لتحليل سجلات الأحداث (Event Logs) وبيانات مراقبة الأنظمة والخدمات. يسمح برفع ملفات السجلات، والتحقق من صحة البيانات، واكتشاف الأحداث غير المعتادة، ثم استعراض الأدلة والتوصيات التي تساعد على بدء التحقيق.

يتكون المشروع من واجهة ويب مبنية باستخدام **React وTypeScript وVite**، وخدمة خلفية باستخدام **Python وFastAPI**. تتولى الخدمة الخلفية تنفيذ مراحل التحليل وحفظ النتائج، بينما تتيح الواجهة استكشاف الأحداث وعمليات التحليل السابقة.

> **تنويه:** TraceMind مشروع تعليمي/بحثي للمساعدة في تحليل السجلات. التوصيات الناتجة هي مؤشرات للتحقيق وليست إثباتًا لسبب جذري مؤكد. لا ينفذ النظام إجراءات على الأنظمة الخارجية؛ إجراءات التحقيق المعروضة للقراءة والتقييم فقط.

## المشكلة التي يعالجها

تنتج التطبيقات والخدمات كميات كبيرة من سجلات الأحداث والقياسات التشغيلية. وقد يصعب اكتشاف الأنماط غير المعتادة وربطها بالأدلة يدويًا.

يساعد TraceMind في تنظيم هذه العملية من خلال:
- استقبال ملفات السجلات والتحقق من تنسيقها وجودة بياناتها.
- اكتشاف الأحداث التي تختلف عن النمط المعتاد.
- تقييم خيارات التحقيق المقترحة وفق معايير محددة.
- تقديم تفسير حتمي (Deterministic) مرتبط بالأدلة المتاحة.
- حفظ نتائج التحليل وإتاحة مراجعتها لاحقًا.

## المزايا الرئيسية

| الميزة | الوصف |
| --- | --- |
| رفع السجلات | دعم CSV وJSON وJSONL وملفات النصوص والسجلات |
| التحقق من البيانات | فحص الحقول والقيم والتنسيقات قبل التحليل |
| اكتشاف الشذوذ | استخدام Isolation Forest لاكتشاف الأحداث غير المعتادة |
| تصنيف الخطورة | استخدام مصنف Severity لتقديم تصنيف مساعد |
| تخطيط التحقيق | استخدام Binary Particle Swarm Optimization لاختيار إجراء قراءة مناسب |
| الوكيل الذكي | إنتاج تفسير وتوصية حتمية بالاعتماد على الأدلة |
| سجل التحليلات | حفظ عمليات التحليل ومراجعتها وحذفها |
| الحسابات | تسجيل الدخول وعزل بيانات المستخدمين |
| واجهة تفاعلية | شاشات Overview وAnalyze وInvestigate وHistory |

## كيف يعمل TraceMind؟

1. **استقبال الملف:** قراءة البيانات وتحديد نوع الملف.
2. **التحقق والمعالجة:** التأكد من صحة البنية والحقول والقيم وتجهيز البيانات.
3. **اكتشاف الشذوذ:** تطبيق Isolation Forest على القياسات الرقمية المناسبة.
4. **تقييم خيارات التحقيق:** استخدام Binary PSO للمساعدة في اختيار إجراء من كتالوج إجراءات القراءة المحدد.
5. **تفسير الأدلة:** يقوم الوكيل الحتمي بربط النتائج والأدلة وصياغة توصية قابلة للمراجعة.
6. **حفظ النتائج:** تخزين نتائج التشغيل والأحداث المرتبطة بها.
7. **عرض النتائج:** استعراض المؤشرات والأحداث والتوصيات وسجل التحليلات.

## التقنيات المستخدمة

| الطبقة | التقنيات |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| معالجة البيانات | Pandas, NumPy |
| Machine Learning | Scikit-learn, Isolation Forest |
| Optimization | Binary Particle Swarm Optimization |
| Intelligent Agent | Deterministic, evidence-based agent |
| Database | SQLite |
| ORM & Migrations | SQLAlchemy, Alembic |
| Authentication | Argon2, JWT, HttpOnly Cookies |
| Testing | Pytest, Frontend tests, Playwright |

## المعمارية

~~~text
┌───────────────────────────────────────┐
│             React Frontend             │
│ Overview · Analyze · Investigate       │
│                History                 │
└───────────────────┬───────────────────┘
                    │ HTTP /api
                    ▼
┌───────────────────────────────────────┐
│             FastAPI Backend            │
│             API Routes & Auth          │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│          Analysis Orchestrator         │
│  Ingestion & Validation                │
│  Isolation Forest                      │
│  Action Catalog + Binary PSO           │
│  Evidence-based Intelligent Agent      │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│        SQLAlchemy Repository           │
│                SQLite                  │
└───────────────────────────────────────┘
~~~

تعتمد الواجهة على Backend API حقيقي، ولا تستخدم بيانات تجريبية لإظهار نتائج تحليل لم يتم تنفيذها. عند تعذر الاتصال بالخدمة الخلفية، تعرض الواجهة حالة عدم توفر Backend بدلًا من اختلاق النتائج.

## هيكل المستودع

~~~text
tracemind-agent/
├── backend/
│   ├── app/
│   │   ├── api/          # مسارات وواجهات API
│   │   ├── core/         # الإعدادات والمكونات الأساسية
│   │   ├── db/           # قاعدة البيانات والتخزين
│   │   ├── models/       # ملفات النماذج وبياناتها
│   │   ├── schemas/      # مخططات البيانات والتحقق
│   │   └── services/     # التحليل والخوارزميات والوكيل
│   ├── tests/            # اختبارات Backend
│   ├── requirements.txt
│   └── alembic.ini
├── docs/
│   ├── architecture/     # توثيق المعمارية وواجهات API
│   ├── validation/       # توثيق التحقق من الخوارزميات
│   └── demo-sample.csv   # ملف بيانات للتجربة
├── scripts/              # سكريبتات التشغيل
├── src/                  # كود واجهة React
├── public/               # الملفات العامة للواجهة
├── Start-TraceMind.bat   # تشغيل سريع على Windows
├── package.json
└── README.md
~~~

## المتطلبات

قبل التشغيل، تأكد من تثبيت:
- **Git** لتنزيل المشروع.
- **Python 3.11 أو أحدث**.
- **Node.js 22 أو أحدث** مع npm.
- اتصال بالإنترنت في أول مرة لتثبيت الاعتماديات.

لا يحتاج مسار التحليل الموجود في المستودع إلى API Key لخدمة ذكاء اصطناعي خارجية.

# تشغيل المشروع على جهازك

## الطريقة الأولى: تشغيل سريع على Windows

1. نزّل المشروع باستخدام Git.
2. افتح مجلد المشروع.
3. شغّل ملف **Start-TraceMind.bat** بالنقر عليه مرتين.

أو افتح PowerShell ونفّذ:

~~~powershell
git clone https://github.com/aiengmohamedtayal-netizen/tracemind-agent.git
cd tracemind-agent
powershell -ExecutionPolicy Bypass -File scripts\start-tracemind.ps1
~~~

يقوم سكريبت التشغيل بتجهيز البيئة الافتراضية، وتثبيت اعتماديات Backend وFrontend عند الحاجة، وتجهيز ملف الإعدادات، وتطبيق ترحيلات قاعدة البيانات، ثم تشغيل الخدمتين وانتظار استجابتهما.

بعد التشغيل افتح:
- **التطبيق:** http://localhost:3000
- **Backend Health:** http://127.0.0.1:8000/api/health

## الطريقة الثانية: التشغيل اليدوي على Windows

افتح نافذتي PowerShell داخل مجلد المشروع.

### 1. تنزيل المشروع

~~~powershell
git clone https://github.com/aiengmohamedtayal-netizen/tracemind-agent.git
cd tracemind-agent
~~~

### 2. إعداد Python Backend

في النافذة الأولى:

~~~powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
~~~

### 3. تجهيز قاعدة البيانات

~~~powershell
$env:PYTHONPATH = "backend"
py -m alembic -c backend\alembic.ini upgrade head
~~~

### 4. تشغيل Backend

~~~powershell
$env:PYTHONPATH = "backend"
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
~~~

اترك النافذة مفتوحة حتى تظل الخدمة الخلفية تعمل.

### 5. تشغيل Frontend

في نافذة PowerShell ثانية، من داخل مجلد المشروع:

~~~powershell
npm install
npm run dev
~~~

افتح http://localhost:3000.

## الطريقة الثالثة: التشغيل اليدوي على Linux وmacOS

### 1. تنزيل المشروع

~~~bash
git clone https://github.com/aiengmohamedtayal-netizen/tracemind-agent.git
cd tracemind-agent
~~~

### 2. إعداد Backend

~~~bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
~~~

### 3. تجهيز قاعدة البيانات

~~~bash
PYTHONPATH=backend python -m alembic -c backend/alembic.ini upgrade head
~~~

### 4. تشغيل Backend

~~~bash
PYTHONPATH=backend python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
~~~

### 5. تشغيل Frontend

افتح Terminal جديدًا داخل مجلد المشروع:

~~~bash
npm install
npm run dev
~~~

ثم افتح http://localhost:3000.

## تجربة المشروع لأول مرة

بعد تشغيل الخدمتين:

1. افتح TraceMind على http://localhost:3000.
2. أنشئ حسابًا من شاشة التسجيل أو سجّل الدخول بحساب محلي أنشأته سابقًا.
3. انتقل إلى **Analyze**.
4. ارفع الملف [docs/demo-sample.csv](docs/demo-sample.csv).
5. ابدأ عملية التحليل.
6. راجع ملخص النتائج في **Overview**.
7. انتقل إلى **Investigate** لفحص الأحداث والأدلة والتوصية.
8. افتح **History** لمراجعة عمليات التحليل السابقة.

### صيغة البيانات المدعومة

يدعم النظام CSV وJSON وJSONL وملفات النصوص والسجلات. ويستخدم ملف CSV المنظم الحقول التالية:

~~~csv
event_id,timestamp,service,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
~~~

قواعد تحقق مهمة:
- يجب أن يكون timestamp بصيغة ISO-8601.
- قيمة error_rate بين 0 و1.
- قيمة cpu_pct بين 0 و100.
- قيمة status_code بين 100 و599.
- الحد الأقصى لحجم الملف 25 MB.

يوجد ملف تجربة جاهز في docs/demo-sample.csv، لذلك لا تحتاج إلى إنشاء Dataset بنفسك للبدء.

## تشغيل الاختبارات

### Backend

من مجلد المشروع وبعد تفعيل البيئة الافتراضية:

~~~powershell
$env:PYTHONPATH = "backend"
py -m pytest backend\tests -q
py -m ruff check backend
~~~

على Linux وmacOS:

~~~bash
PYTHONPATH=backend python -m pytest backend/tests -q
python -m ruff check backend
~~~

### Frontend

~~~bash
npm run lint
npm test
npm run build
~~~

### اختبارات End-to-End

~~~bash
npx playwright test
~~~

قد تحتاج إلى تثبيت متصفحات Playwright لأول مرة وفق تعليمات Playwright الخاصة ببيئتك.

## توثيق إضافي

- [مرجع API](docs/architecture/api-reference.md)
- [نظرة عامة على المعمارية](docs/architecture/architecture-overview.md)
- [تدفق البيانات](docs/architecture/data-flow.md)
- [مبررات تصميم Binary PSO](docs/validation/pso-design-rationale.md)
- [تقرير المشروع](TraceMind_Bilingual_Project_Report.md)

## حدود المشروع وملاحظات مهمة

- المشروع مخصص للتجربة والتقييم التعليمي، وليس نظامًا تشغيليًا لاتخاذ قرارات تلقائية في بيئات الإنتاج.
- نتائج Isolation Forest ودرجات الخطورة مؤشرات تحليلية يجب تفسيرها في سياق البيانات.
- توصيات الوكيل مسارات تحقيق مقترحة وليست تأكيدًا لسبب المشكلة.
- Binary PSO يختار من كتالوج محدود لإجراءات التحقيق للقراءة فقط؛ ولا ينفذ أوامر على الخدمات أو الخوادم.
- لا يتضمن المشروع تنفيذًا تلقائيًا لمعالجة الحوادث أو تكاملًا مفترضًا مع أنظمة مراقبة خارجية.

## المساهمة

المساهمات مرحب بها. قبل اقتراح تغيير:
1. راجع بنية المشروع والوثائق ذات الصلة.
2. افتح Issue لوصف المشكلة أو الميزة المقترحة.
3. اجعل التغييرات محددة وقابلة للاختبار.
4. أضف أو حدّث الاختبارات والوثائق عند الحاجة.

## الترخيص

راجع ملف الترخيص الموجود في المستودع لمعرفة شروط الاستخدام وإعادة التوزيع.

---

<p align="center">
  <strong>TraceMind — من سجلات الأحداث إلى أدلة أوضح وقرارات تحقيق أفضل.</strong>
</p>

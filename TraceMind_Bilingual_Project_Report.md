# TraceMind Bilingual Technical Project Report (Markdown Companion Source)

> Extracted verbatim from TraceMind_Bilingual_Project_Report.docx so the report text is readable and diffable in Git alongside the binary .docx.

TraceMind

Bilingual Technical Project Report

تقرير تقني ثنائي اللغة عن المشروع

Event Log Analysis • Anomaly Detection • Intelligent Investigation Support

Prepared from the project context and implementation details available in the conversationتم إعداد التقرير اعتمادًا على معلومات المشروع وتفاصيل التنفيذ المتاحة في المحادثات

## 1. Executive Summary | الملخص التنفيذي

TraceMind is an educational software platform for analyzing event-log data supplied in CSV or JSON format. It combines anomaly detection, optimization, and a rule-based intelligent recommendation component to help users identify unusual records and organize investigation actions.TraceMind هو تطبيق برمجي تعليمي لتحليل بيانات سجلات الأحداث (Event Logs) الواردة بصيغ CSV أو JSON. يجمع المشروع بين اكتشاف الحالات غير الطبيعية، وخوارزميات التحسين، ومحرك توصيات ذكي قائم على القواعد؛ لمساعدة المستخدم على تحديد السجلات غير المعتادة وتنظيم إجراءات التحقيق.

The system is structured as a React/Vite frontend connected to a Python/FastAPI backend. An analysis orchestrator coordinates ingestion and validation, Isolation Forest detection, Binary Particle Swarm Optimization (BPSO), recommendation rules, and persistence through SQLAlchemy with SQLite.يتكون النظام من واجهة أمامية باستخدام React وVite، متصلة بخلفية برمجية باستخدام Python وFastAPI. ويتولى Analysis Orchestrator تنسيق استيراد البيانات والتحقق منها، وتشغيل Isolation Forest، وخوارزمية Binary Particle Swarm Optimization (BPSO)، وقواعد التوصيات، ثم حفظ النتائج باستخدام SQLAlchemy وSQLite.

## 2. Problem Statement | المشكلة التي يعالجها المشروع

Event logs can contain many records, making manual review slow and inconsistent. Unusual behavior may be difficult to spot, and analysts may need a structured way to decide which records deserve attention and what investigation actions should be considered.قد تحتوي سجلات الأحداث على عدد كبير من السجلات، مما يجعل مراجعتها يدويًا عملية بطيئة وغير متسقة. كما قد يصعب اكتشاف السلوك غير المعتاد، وقد يحتاج المحلل إلى طريقة منظمة لتحديد السجلات التي تستحق الاهتمام واختيار إجراءات التحقيق المناسبة.

Large volumes of event records are difficult to inspect manually. — يصعب فحص كميات كبيرة من سجلات الأحداث يدويًا.

Potential anomalies may be overlooked during routine review. — قد تمر بعض الحالات غير الطبيعية دون ملاحظة أثناء المراجعة التقليدية.

Investigation actions need prioritization and organization. — تحتاج إجراءات التحقيق إلى ترتيب الأولويات والتنظيم.

Analysis outcomes should be stored for later review. — ينبغي حفظ نتائج التحليل للرجوع إليها ومراجعتها لاحقًا.

## 3. Project Objectives | أهداف المشروع

Import CSV and JSON event-log files and validate their structure. — استيراد ملفات Event Logs بصيغتي CSV وJSON والتحقق من بنيتها.

Detect unusual records using an unsupervised anomaly-detection algorithm. — اكتشاف السجلات غير الطبيعية باستخدام خوارزمية لا تعتمد على بيانات مصنفة مسبقًا.

Optimize the selection of investigation actions using BPSO. — تحسين اختيار إجراءات التحقيق باستخدام BPSO.

Generate rule-based recommendations based on analysis results. — إنشاء توصيات قائمة على القواعد وفقًا لنتائج التحليل.

Persist analysis runs and make historical results accessible. — حفظ عمليات التحليل وإتاحة النتائج السابقة للمراجعة.

## 4. Technology Stack | التقنيات والأدوات المستخدمة

Layer / Component

Technology

Purpose / الغرض

Frontend

React, Vite

الواجهة الأمامية وبناء واجهة المستخدم التفاعلية

Backend

Python, FastAPI, Uvicorn

الخلفية البرمجية وتوفير واجهات REST API وتشغيل الخادم

Data validation

Pydantic and ingestion/validation logic

التحقق من البيانات وبنية المدخلات

Machine Learning

Scikit-learn, Isolation Forest

اكتشاف الحالات غير الطبيعية

Optimization

Binary Particle Swarm Optimization (BPSO)

اختيار مجموعة مناسبة من إجراءات التحقيق

Agent / Recommendations

Rule-Based Intelligent Agent

تفسير نتائج التحليل وفق قواعد وإنتاج توصيات

ORM

SQLAlchemy

التعامل مع قاعدة البيانات من خلال ORM

Database

SQLite

حفظ سجلات التحليل والنتائج

Input formats

CSV, JSON

صيغ ملفات البيانات المدعومة

Implementation note | ملاحظة تنفيذية: The stack above reflects technologies identified in the available project context. Specific package versions and any additional libraries should be verified against the current repository files.تعكس القائمة التقنيات المذكورة في سياق المشروع المتاح. يجب مراجعة إصدارات الحزم وأي مكتبات إضافية بالرجوع إلى ملفات المستودع الحالية.

## 5. Core Algorithms and Intelligent Components | الخوارزميات والمكونات الذكية الأساسية

### 5.1 Isolation Forest — Anomaly Detection | اكتشاف الحالات غير الطبيعية

Isolation Forest is an unsupervised learning algorithm used to identify observations that differ from the majority of the data. It builds randomized isolation trees; observations that can be isolated with relatively short paths are treated as more anomalous. In TraceMind, it is used as the anomaly-detection stage of the analysis pipeline.Isolation Forest هي خوارزمية تعلم غير خاضع للإشراف تُستخدم لتحديد السجلات التي تختلف عن النمط العام للبيانات. تنشئ الخوارزمية أشجار عزل عشوائية، وتُعد السجلات التي يسهل عزلها عبر مسارات أقصر أكثر احتمالًا لكونها غير طبيعية. ويستخدمها TraceMind في مرحلة اكتشاف الحالات غير الطبيعية.

### 5.2 Binary Particle Swarm Optimization (BPSO) | خوارزمية تحسين سرب الجسيمات الثنائية

BPSO is a population-based optimization method inspired by swarm behavior. Candidate solutions are represented in binary form, and particles update their positions based on their own best-known solution and the swarm's best-known solution. TraceMind uses this optimization component to select investigation actions according to the objective and constraints defined by the implementation.BPSO هي طريقة تحسين تعتمد على مجموعة من الحلول، ومستوحاة من سلوك الأسراب. تُمثّل الحلول المرشحة بصيغة ثنائية، وتُحدّث الجسيمات مواقعها اعتمادًا على أفضل حل وصلت إليه وأفضل حل وصل إليه السرب. يستخدم TraceMind هذا المكوّن لاختيار إجراءات التحقيق وفق دالة الهدف والقيود المحددة في التنفيذ.

### 5.3 Rule-Based Intelligent Agent | الوكيل الذكي القائم على القواعد

The current agent component is described as rule-based. It consumes analysis outputs and applies predefined rules to produce recommendations or investigation guidance. It should not be described as an LLM-powered or fully autonomous agent unless such capabilities are confirmed in the codebase.يوصف مكوّن الـ Agent في الحالة الحالية بأنه قائم على القواعد (Rule-Based). يستقبل نتائج التحليل ويطبق قواعد محددة مسبقًا لإنتاج توصيات أو إرشادات للتحقيق. ولا ينبغي وصفه بأنه يعتمد على LLM أو يعمل باستقلالية كاملة إلا إذا تأكد وجود هذه الإمكانات في الكود.

## 6. System Architecture | معمارية النظام

TraceMind follows a layered architecture that separates the user interface, API layer, analysis orchestration, algorithmic components, and persistence. The frontend communicates with the backend through HTTP/REST endpoints. The backend orchestrator coordinates the processing pipeline and delegates specialized tasks to the relevant components.يتبع TraceMind معمارية متعددة الطبقات تفصل بين واجهة المستخدم، وطبقة API، ومنسق التحليل، والمكونات الخوارزمية، وطبقة حفظ البيانات. تتواصل الواجهة الأمامية مع الخلفية من خلال HTTP/REST، بينما ينسق Analysis Orchestrator مراحل المعالجة ويوجه كل مهمة إلى المكوّن المسؤول عنها.

Layer

Component / Technology

Responsibility / المسؤولية

Presentation Layer

React + Vite

عرض الصفحات والتفاعل مع المستخدم

API Layer

FastAPI

استقبال الطلبات وإرجاع الاستجابات

Ingestion & Validation

CSV/JSON processing

قراءة البيانات والتحقق من صحتها

Detection Layer

Isolation Forest

تحديد السجلات غير الطبيعية

Optimization Layer

BPSO + Action Catalog

اختيار إجراءات التحقيق

Recommendation Layer

Rule-Based Agent

توليد التوصيات

Persistence Layer

SQLAlchemy + SQLite

حفظ عمليات التحليل ونتائجها

## 7. End-to-End Workflow | تسلسل عمل النظام

Upload | The user uploads an event-log file in CSV or JSON format.

يرفع المستخدم ملف Event Logs بصيغة CSV أو JSON.

Ingestion and validation | The backend parses the file and checks required fields and data consistency.

تقرأ الخلفية الملف وتتحقق من الحقول المطلوبة واتساق البيانات.

Anomaly detection | The detection component processes the prepared records using Isolation Forest.

يعالج مكوّن الاكتشاف السجلات المجهزة باستخدام Isolation Forest.

Action optimization | BPSO evaluates candidate action combinations and selects a suitable set.

تقيّم BPSO مجموعات إجراءات مرشحة وتختار مجموعة مناسبة.

Recommendations | The rule-based agent applies its rules to the analysis outputs.

يطبق الـ Agent القائم على القواعد قواعده على نتائج التحليل.

Persistence and review | The run and its outputs are stored and can be reviewed through the application.

تُحفظ عملية التحليل ومخرجاتها لتكون متاحة للمراجعة داخل التطبيق.

## 8. Main Application Modules | الوحدات الرئيسية للتطبيق

Overview: A summary view for key system information and analysis activity.Overview: واجهة ملخص للمعلومات الأساسية ونشاط التحليل.

Analyze: The workspace for uploading event logs and starting analysis.Analyze: مساحة رفع ملفات Event Logs وبدء التحليل.

Investigate: A workspace for reviewing detected anomalies and recommendations.Investigate: مساحة مراجعة الحالات المكتشفة والتوصيات.

History: A view of previously stored analysis runs.History: واجهة لعرض عمليات التحليل المحفوظة سابقًا.

## 9. Testing and Algorithm Validation | الاختبارات والتحقق من الخوارزميات

The available project notes describe an Isolation Forest validation experiment using a synthetic dataset of 34 records: 30 normal records and 4 injected anomalies. The experiment compared contamination settings of 0.05, 0.12, and 0.20 and evaluated Precision, Recall, and F1-score. A validation script and report were also recorded: fixtures.py, run_algorithm_validation.py, and algorithm-validation-report.md.تشير ملاحظات المشروع المتاحة إلى تجربة للتحقق من Isolation Forest باستخدام بيانات اصطناعية تتكون من 34 سجلًا: 30 سجلًا طبيعيًا و4 حالات غير طبيعية مضافة للاختبار. قارنت التجربة قيم Contamination وهي 0.05 و0.12 و0.20، مع تقييم Precision وRecall وF1-score. كما تم تسجيل ملفات للتحقق والتوثيق: fixtures.py وrun_algorithm_validation.py وalgorithm-validation-report.md.

Validation limitation | حدود التحقق: The dataset is small and synthetic. These results are useful for checking pipeline behavior, but they do not establish production-level accuracy or generalization to real-world logs. The actual metric values should be taken from the validation report, not inferred here.مجموعة البيانات صغيرة واصطناعية. تفيد هذه التجربة في فحص سلوك مسار التحليل، لكنها لا تثبت دقة مناسبة لبيئة إنتاجية أو قدرة التعميم على سجلات واقعية. يجب نقل القيم الفعلية للمقاييس من تقرير التحقق، وعدم افتراضها.

## 10. Operational Scope and Constraints | نطاق التشغيل والقيود

The frontend is intended to consume backend APIs rather than simulate analysis locally. — من المفترض أن تعتمد الواجهة على Backend APIs بدلًا من محاكاة التحليل محليًا.

The system is an educational analysis and investigation-support tool. — النظام أداة تعليمية للتحليل ودعم التحقيق.

Investigation actions are intended to be read-only; no intrusive actions, network scanning, or penetration testing are part of the stated scope. — إجراءات التحقيق مصممة لتكون للقراءة فقط؛ ولا يشمل النطاق المعلن تنفيذ إجراءات تدخلية أو فحص الشبكات أو اختبارات اختراق.

## 11. Future Enhancements | التطويرات المستقبلية المقترحة

Explainable AI: provide feature-level explanations for anomaly scores. — Explainable AI: توضيح العوامل التي أثرت في درجة اكتشاف الحالة غير الطبيعية.

LLM-assisted explanations: add natural-language summaries while keeping decisions traceable and rule-governed. — إضافة تفسيرات بلغة طبيعية بمساعدة LLM مع الحفاظ على قابلية تتبع القرارات وخضوعها للقواعد.

Real-time ingestion: support event streams where required. — دعم استقبال الأحداث في الوقت الفعلي عند الحاجة.

Scalable persistence: consider PostgreSQL when multi-user or deployment requirements justify it. — النظر في PostgreSQL عند الحاجة إلى تعدد المستخدمين أو متطلبات نشر أوسع.

Security and access control: add authentication, authorization, audit logging, and input hardening. — إضافة Authentication وAuthorization وسجلات تدقيق وتحسين حماية المدخلات.

Broader evaluation: validate on representative real-world datasets and monitor false positives/negatives. — توسيع التقييم باستخدام بيانات واقعية ممثلة ومراقبة False Positives وFalse Negatives.

## 12. Project Repositories and References | مستودعات المشروع والمراجع

Main repository: https://github.com/aiengmohamedtayal-netizen/tracemind

Related backend repository: tracemind-agent (repository URL should be confirmed before publication).

المستودع الرئيسي: https://github.com/aiengmohamedtayal-netizen/tracemind

مستودع الخلفية المرتبط: tracemind-agent (يجب تأكيد الرابط قبل النشر).

## 13. Conclusion | الخاتمة

TraceMind demonstrates an integrated approach to event-log analysis by combining unsupervised anomaly detection, binary optimization, and rule-based recommendations within a web application. Its modular architecture separates presentation, processing, algorithms, and persistence, providing a foundation for further validation and future enhancements.يقدم TraceMind نهجًا متكاملًا لتحليل سجلات الأحداث من خلال الجمع بين اكتشاف الحالات غير الطبيعية بالتعلم غير الخاضع للإشراف، والتحسين الثنائي، والتوصيات القائمة على القواعد داخل تطبيق ويب. وتوفر معمارية النظام المعيارية فصلًا بين العرض والمعالجة والخوارزميات وحفظ البيانات، بما يشكل أساسًا مناسبًا لمزيد من التحقق والتطوير.

Report accuracy note | ملاحظة حول دقة التقرير

This report is based on project information available in the conversation and is not a fresh source-code audit. Before formal submission, verify package versions, exact API routes, database schema, measured validation metrics, and the current implementation status against the repositories.يعتمد هذا التقرير على معلومات المشروع المتاحة في المحادثات، ولا يمثل مراجعة حديثة للكود المصدري. قبل التسليم الرسمي، يجب التحقق من إصدارات الحزم، ومسارات API الفعلية، ومخطط قاعدة البيانات، وقيم مقاييس التحقق، وحالة التنفيذ الحالية بالرجوع إلى المستودعات.

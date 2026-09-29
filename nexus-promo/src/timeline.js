// Nexus CRM promo — master timeline (30 fps, 1800 frames, 1080x1920).
// `vo[].dur` is written by build/measure_vo.py from the real voice-over files;
// captions are re-timed from it automatically.
window.TIMELINE = {
  fps: 30,
  frames: 1800,
  scenes: [
    { id: 1, name: 'The Problem',          start: 0,    end: 210 },
    { id: 2, name: 'Enter Nexus',          start: 210,  end: 450 },
    { id: 3, name: 'Organize & Assign',    start: 450,  end: 780 },
    { id: 4, name: 'Conversation Workspace', start: 780, end: 1080 },
    { id: 5, name: 'Sales Pipeline',       start: 1080, end: 1410 },
    { id: 6, name: 'Business Visibility',  start: 1410, end: 1650 },
    { id: 7, name: 'Final Brand Reveal',   start: 1650, end: 1800 },
  ],
  // start = seconds on the master timeline, dur = spoken length in seconds,
  // marks = caption chunk starts (s, relative to start) aligned to pauses in the recorded voice-over.
  vo: [
    { scene: 1, start: 0.35, dur: 6.04, marks: [0, 1.81, 4.01], chunks: ['بتصرف على إعلانات…', 'والليدز بتوصلك من كل مكان.', 'بس كام فرصة بتضيع وسط الزحمة؟'] },
    { scene: 2, start: 7.35, dur: 7.50, marks: [0, 1.7, 4.16, 6.6], chunks: ['مع Nexus CRM،', 'كل فرصة بتدخل في نظام واحد…', 'من إعلانات ميتا، وموقعك،', 'وقنوات التواصل.'] },
    { scene: 3, start: 15.35, dur: 8.76, marks: [0, 1.76, 3.28, 6.2], chunks: ['ينظم بيانات العملاء،', 'يقلل التكرار،', 'ويوزع الفرص على فريقك بقواعد واضحة…', 'مع متابعة سرعة الاستجابة والتنبيهات.'] },
    { scene: 4, start: 26.35, dur: 6.53, marks: [0, 2.27, 4.74], chunks: ['تابع المحادثات المرتبطة بعملائك،', 'وشوف التفاصيل والمهام من مكان واحد…', 'بدل ما تضيع بين الشاشات.'] },
    { scene: 5, start: 36.35, dur: 7.64, marks: [0, 1.36, 4.58, 5.96], chunks: ['من أول متابعة،', 'لحد إدارة مراحل البيع والفرص والمهام…', 'كل خطوة واضحة،', 'وكل فرصة ليها مسؤول.'] },
    { scene: 6, start: 47.35, dur: 7.46, marks: [0, 1.57, 3.41, 4.89], chunks: ['ومن التقارير،', 'اعرف مصادر الفرص،', 'وتابع أداء فريقك،', 'واتخذ قراراتك بناءً على بيانات.'] },
    // Scene 7 line is carried by the on-screen tagline, so it has no caption chunks.
    { scene: 7, start: 55.6, dur: 3.60, chunks: [] },
  ],
};

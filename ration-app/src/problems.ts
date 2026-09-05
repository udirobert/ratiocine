// GENERATED from showcase/app/play/puzzle-data.ts — do not hand-edit.
// Regenerate: node /tmp/extract-problems.cjs
// Ten real IOL-style language problems, each with ground truth so the
// canister grades deterministically (EM + chrF) before chain-key signing.

export type AppProblem = {
  id: string;
  label: string;
  language: string;
  family: string;
  region: string;
  task_type: string;
  context: string;
  query: string;
  ground_truth: string[];
};

export const APP_PROBLEMS: AppProblem[] = [
  {
    id: "apurina-verb-agreement",
    label: "Apurinã · Verb Agreement",
    language: "Apurinã",
    family: "Arawakan",
    region: "Amazonas, Brazil",
    task_type: "translation",
    context: "Language: Apurinã\nTask: verb agreement\n\nEvidence:\n1. nhaapitaka = I am going\n2. ãpitaka = you are going\n3. apitaka = he/she is going\n4. nhaakutaka = I am eating\n5. ãkutaka = you are eating\n6. akutaka = he/she is eating\n7. nhaanykataka = I am speaking\n8. ãnykataka = you are speaking\n9. anykataka = he/she is speaking\n10. kaapitaka = we (everyone) are going",
    query: "Translate each English phrase into Apurinã.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. I am eating\n2. we (everyone) are eating\n3. you are speaking\n4. we (everyone) are speaking\n5. he/she is going",
    ground_truth: ["nhaakutaka", "kaakutaka", "ãnykataka", "kaanykataka", "apitaka"],
  },
  {
    id: "swahili-person-tense",
    label: "Swahili · Person & Tense",
    language: "Swahili",
    family: "Niger-Congo · Bantu",
    region: "East Africa — Kenya, Tanzania, Uganda",
    task_type: "translation",
    context: "Language: Swahili\nTask: person & tense\n\nEvidence:\n1. ninapenda = I like\n2. unasoma = you read\n3. anacheza = she plays\n4. nilipenda = I liked\n5. tulisoma = we read (past)\n6. utacheza = you will play\n7. wataimba = they will sing\n8. anaimba = he sings",
    query: "Translate each English phrase into Swahili.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. I will like\n2. they read\n3. we sang",
    ground_truth: ["nitapenda", "wanasoma", "tuliimba"],
  },
  {
    id: "turkish-vowel-harmony",
    label: "Turkish · Vowel Harmony",
    language: "Turkish",
    family: "Turkic",
    region: "Türkiye & the Eastern Mediterranean",
    task_type: "translation",
    context: "Language: Turkish\nTask: vowel harmony\n\nEvidence:\n1. ev = house\n2. at = horse\n3. kız = girl\n4. göz = eye\n5. gün = day\n6. el = hand\n7. evler = houses\n8. atlar = horses\n9. eller = hands\n10. kitaplar = books",
    query: "Translate each English phrase into Turkish.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. eyes\n2. girls\n3. days",
    ground_truth: ["gözler", "kızlar", "günler"],
  },
  {
    id: "quechua-person-endings",
    label: "Quechua · Person Endings",
    language: "Quechua",
    family: "Quechuan",
    region: "The Andes — Peru, Bolivia, Ecuador",
    task_type: "translation",
    context: "Language: Quechua\nTask: person endings\n\nEvidence:\n1. rimani = I speak\n2. rimanki = you speak\n3. riman = she speaks\n4. rikuni = I see\n5. mikhunki = you eat\n6. purin = he walks\n7. rimanchik = we (all of us) speak\n8. mikhunchik = we (all of us) eat",
    query: "Translate each English phrase into Quechua.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. I walk\n2. we (all of us) see\n3. she eats",
    ground_truth: ["purini", "rikunchik", "mikhun"],
  },
  {
    id: "nahuatl-both-ends",
    label: "Nahuatl · Both Ends of the Verb",
    language: "Nahuatl",
    family: "Uto-Aztecan",
    region: "Central Mexico — Puebla, Guerrero, Veracruz",
    task_type: "translation",
    context: "Language: Nahuatl\nTask: both ends of the verb\n\nEvidence:\n1. nicochi = I sleep\n2. ticochi = you sleep\n3. cochi = he sleeps\n4. nichoca = I cry\n5. ticuica = you sing\n6. cuicah = they sing\n7. nicochih = we sleep",
    query: "Translate each English phrase into Nahuatl.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. I sing\n2. they cry\n3. we sing",
    ground_truth: ["nicuica", "chocah", "nicuicah"],
  },
  {
    id: "esperanto-tense",
    label: "Esperanto · Tense Endings",
    language: "Esperanto",
    family: "Constructed · Romance/Germanic roots",
    region: "Worldwide (born in Warsaw)",
    task_type: "translation",
    context: "Language: Esperanto\nTask: tense endings\n\nEvidence:\n1. mi lernas = I learn\n2. mi lernis = I learned\n3. mi lernos = I will learn\n4. vi lernas = you learn\n5. li lernas = he learns\n6. ni lernas = we learn\n7. mi manĝas = I eat\n8. ili lernas = they learn",
    query: "Translate each English phrase into Esperanto.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. you learned\n2. we learned\n3. I will eat\n4. they eat\n5. he ate",
    ground_truth: ["vi lernis", "ni lernis", "mi manĝos", "ili manĝas", "li manĝis"],
  },
  {
    id: "indonesian-plurals",
    label: "Indonesian · Plurals by Doubling",
    language: "Indonesian",
    family: "Austronesian · Malayo-Polynesian",
    region: "Indonesia (Jakarta)",
    task_type: "translation",
    context: "Language: Indonesian\nTask: plurals by doubling\n\nEvidence:\n1. anak = child\n2. anak-anak = children\n3. kuda = horse\n4. kuda-kuda = horses\n5. saya makan = I eat\n6. mereka makan = they eat\n7. buku = book\n8. buku-buku = books\n9. kami makan = we eat",
    query: "Translate each English phrase into Indonesian.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. I eat\n2. children\n3. horses\n4. books\n5. we eat",
    ground_truth: ["saya makan", "anak-anak", "kuda-kuda", "buku-buku", "kami makan"],
  },
  {
    id: "finnish-harmony",
    label: "Finnish · Harmony Endings",
    language: "Finnish",
    family: "Uralic · Finnic",
    region: "Finland (Helsinki)",
    task_type: "translation",
    context: "Language: Finnish\nTask: harmony endings\n\nEvidence:\n1. talo = house\n2. talot = houses\n3. talossa = in the house\n4. kylä = village\n5. kylät = villages\n6. kylässä = in the village\n7. koulu = school\n8. koulut = schools\n9. koulussa = in the school",
    query: "Translate each English phrase into Finnish.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. houses\n2. in the house\n3. villages\n4. in the village\n5. in the school",
    ground_truth: ["talot", "talossa", "kylät", "kylässä", "koulussa"],
  },
  {
    id: "maori-pronouns",
    label: "Māori · Who Is 'We'?",
    language: "Māori",
    family: "Austronesian · Polynesian",
    region: "Aotearoa (Wellington)",
    task_type: "translation",
    context: "Language: Māori\nTask: who is 'we'?\n\nEvidence:\n1. au = I\n2. koe = you\n3. ia = he/she\n4. māua = we two, not you\n5. tāua = you and I\n6. mātou = we, not you\n7. tātou = all of us, incl. you\n8. rāua = they two\n9. rātou = they all",
    query: "Translate each English phrase into Māori.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. we two, not you\n2. all of us, incl. you\n3. they two\n4. they all\n5. we, not you",
    ground_truth: ["māua", "tātou", "rāua", "rātou", "mātou"],
  },
  {
    id: "zulu-noun-class",
    label: "Zulu · Noun Classes",
    language: "Zulu",
    family: "Niger-Congo · Bantu",
    region: "South Africa (Durban)",
    task_type: "translation",
    context: "Language: Zulu\nTask: noun classes\n\nEvidence:\n1. umntwana = child\n2. abantwana = children\n3. umfana = boy\n4. abafana = boys\n5. isikolo = school\n6. izikolo = schools\n7. umfundi = student\n8. abafundi = students",
    query: "Translate each English phrase into Zulu.\nReturn one unsegmented verb form per numbered item, in order.\n\n1. boy\n2. children\n3. school\n4. schools\n5. students",
    ground_truth: ["umfana", "abantwana", "isikolo", "izikolo", "abafundi"],
  },
];

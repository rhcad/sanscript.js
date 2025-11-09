// noinspection NonAsciiCharacters,JSNonASCIINames

/**
 * Sanscript
 *
 * Sanscript is a Sanskrit transliteration library. Currently, it supports
 * other Indian languages only incidentally.
 *
 * License: MIT
 */

function exportSanscriptSingleton (global, schemes, devanagariVowelToMarks) {
    "use strict";

    const Sanscript = {};
    // First, we define the Sanscript singleton, with its variables and methods.
    Sanscript.defaults = {
        "skip_sgml"            : false,
        "syncope"              : false,
        "preferred_alternates" : {},
        "split_aksara"         : false,
        "move_consonant"       : false,
    };

    const DETECTION_PATTERNS = {
        SCHEMES : [
            ['Bengali', 0x0980],
            ['Devanagari', 0x0900],
            ['Gujarati', 0x0a80],
            ['Gurmukhi', 0x0a00],
            ['Kannada', 0x0c80],
            ['Malayalam', 0x0d00],
            ['Oriya', 0x0b00],
            ['Tamil', 0x0b80],
            ['Telugu', 0x0c00],
            ['HK', null],
            ['IAST', null],
            ['ITRANS', null],
            ['Kolkata', null],
            ['SLP1', null],
            ['Velthuis', null],
        ],
        // Start of the Devanagari block.
        BRAHMIC_FIRST_CODE_POINT : 0x0900,

        // End of the Malayalam block.
        BRAHMIC_LAST_CODE_POINT : 0x0d7f,

        // Match on special Roman characters
        RE_IAST_OR_KOLKATA_ONLY : /[āīūṛṝḷḹēōṃḥṅñṭḍṇśṣḻ]/,

        // Match on chars shared by ITRANS and Velthuis
        RE_ITRANS_OR_VELTHUIS_ONLY : /aa|ii|uu|~n/,

        // Match on ITRANS-only
        RE_ITRANS_ONLY : /ee|oo|\^[iI]|RR[iI]|L[iI]|~N|N\^|Ch|chh|JN|sh|Sh|\.a/,

        // Match on Kolkata-specific Roman characters
        RE_KOLKATA_ONLY : /[ēō]/,

        // Match on SLP1-only characters and bigrams
        RE_SLP1_ONLY : RegExp(['[fFxXEOCYwWqQPB]|kz|Nk|Ng|tT|dD|Sc|Sn|',
            '[aAiIuUfFxXeEoO]R|',
            'G[yr]|(\\W|^)G'].join('')),

        // Match on Velthuis-only characters
        RE_VELTHUIS_ONLY : /\.[mhnrltds]|"n|~s/,

    };

    /**
     * Detect the transliteration scheme of the given text
     * @param {string} text - Input text to analyze
     * @returns {string} - Detected scheme name or 'Unknown'
     */
    Sanscript.detect = function (text) {
        const Scheme = {};
        for (let i = 0; i < DETECTION_PATTERNS.SCHEMES.length; i++) {
            const value = DETECTION_PATTERNS.SCHEMES[i][0];
            Scheme[value] = value;
        }
        // Schemes sorted by Unicode code point. Ignore schemes with none defined.
        const BLOCKS = DETECTION_PATTERNS.SCHEMES
            .filter(function (x) {
                return x[1];
            })  // keep non-null
            .sort(function (x, y) {
                return y[1] - x[1];
            });  // sort by code point
        // Brahmic schemes are all within a specific range of code points.
        for (let i = 0; i < text.length; i++) {
            const L = text[i];
            const code = L.charCodeAt(0);
            if (code >= DETECTION_PATTERNS.BRAHMIC_FIRST_CODE_POINT && code <= DETECTION_PATTERNS.BRAHMIC_LAST_CODE_POINT) {
                for (let j = 0; j < BLOCKS.length; j++) {
                    const block = BLOCKS[j];
                    if (code >= block[1]) {
                        return block[0];
                    }
                }
            }
        }

        // Romanizations
        if (DETECTION_PATTERNS.RE_IAST_OR_KOLKATA_ONLY.test(text)) {
            if (DETECTION_PATTERNS.RE_KOLKATA_ONLY.test(text)) {
                return Scheme.Kolkata;
            }
            return Scheme.IAST;
        }

        if (DETECTION_PATTERNS.RE_ITRANS_ONLY.test(text)) {
            return Scheme.ITRANS;
        }

        if (DETECTION_PATTERNS.RE_SLP1_ONLY.test(text)) {
            return Scheme.SLP1;
        }

        if (DETECTION_PATTERNS.RE_VELTHUIS_ONLY.test(text)) {
            return Scheme.Velthuis;
        }

        if (DETECTION_PATTERNS.RE_ITRANS_OR_VELTHUIS_ONLY.test(text)) {
            return Scheme.ITRANS;
        }

        return Scheme.HK;

    };


    /* Schemes
     * =======
     * Schemes are of two kinds: "Brahmic" and "roman." "Brahmic" schemes
     * describe abugida scripts found in India. "Roman" schemes describe
     * manufactured alphabets that are meant to describe or encode Brahmi
     * scripts. Abugidas and alphabets are processed by separate algorithms
     * because of the unique difficulties involved with each.
     *
     * Brahmic consonants are stated without a virama. Roman consonants are
     * stated without the vowel 'a'.
     *
     * (Since "abugida" is not a well-known term, Sanscript uses "Brahmic"
     * and "roman" for clarity.)
     */
    Sanscript.schemes = schemes;
    // Set of names of schemes
    const romanSchemes = {};

    // object cache
    let cache = {};

    /**
     * Add a Brahmic scheme to Sanscript.
     *
     * Schemes are of two types: "Brahmic" and "roman". Brahmic consonants
     * have an inherent vowel sound, but roman consonants do not. This is the
     * main difference between these two types of scheme.
     *
     * A scheme definition is an object ("{}") that maps a group name to a
     * list of characters. For illustration, see the "devanagari" scheme at
     * the top of this file.
     *
     * You can use whatever group names you like, but for the best results,
     * you should use the same group names that Sanscript does.
     *
     * @param name    the scheme name
     * @param scheme  the scheme data itself. This should be constructed as
     *                described above.
     */
    Sanscript.addBrahmicScheme = function (name, scheme) {
        Sanscript.schemes[name] = scheme;
    };

    /**
     * Add a roman scheme to Sanscript.
     *
     * See the comments on Sanscript.addBrahmicScheme. The "vowel_marks" field
     * can be omitted.
     *
     * @param name    the scheme name
     * @param scheme  the scheme data itself
     */
    Sanscript.addRomanScheme = function (name, scheme) {
        if (!("vowel_marks" in scheme)) {
            scheme.vowel_marks = {};
            for (const [key, value] of Object.entries(scheme.vowels)) {
                if (key !== "अ") {
                    scheme.vowel_marks[devanagariVowelToMarks[key]] = value;
                }
            }
        }
        Sanscript.schemes[name] = scheme;
        romanSchemes[name] = true;
    };


    // Set up various schemes
    (function () {
        // Set up roman schemes
        const capitalize = function (text) {
            return text.charAt(0).toUpperCase() + text.substring(1, text.length);
        };
        const addCapitalAlternates = function (codeList, alternatesMap) {
            for (const v of codeList) {
                const initAlternatesList = alternatesMap[v] || [];
                let alternatesList = initAlternatesList;
                alternatesList = alternatesList.concat(capitalize(v));
                for (const alternate of initAlternatesList) {
                    alternatesList = alternatesList.concat(capitalize(alternate));
                }
                alternatesMap[v] = alternatesList;
            }
        };
        addCapitalAlternates(Object.values(schemes.iast.vowels), schemes.iast.alternates);
        addCapitalAlternates(Object.values(schemes.iast.consonants), schemes.iast.alternates);
        addCapitalAlternates(Object.values(schemes.iast.extra_consonants), schemes.iast.alternates);
        addCapitalAlternates(["oṃ"], schemes.iast.alternates);
        addCapitalAlternates(Object.values(schemes.kolkata_v2.vowels), schemes.kolkata_v2.alternates);
        addCapitalAlternates(Object.values(schemes.kolkata_v2.consonants), schemes.kolkata_v2.alternates);
        addCapitalAlternates(Object.values(schemes.kolkata_v2.extra_consonants), schemes.kolkata_v2.alternates);

        addCapitalAlternates(Object.values(schemes.iso.vowels), schemes.iso.alternates);
        addCapitalAlternates(Object.values(schemes.iso.consonants), schemes.iso.alternates);
        addCapitalAlternates(Object.values(schemes.iso.extra_consonants), schemes.iso.alternates);
        addCapitalAlternates(["ōṁ"], schemes.iso.alternates);

        // These schemes already belong to Sanscript.schemes. But by adding
        // them again with `addRomanScheme`, we automatically build up
        // `romanSchemes` and define a `vowel_marks` field for each one.
        for (const [schemeName, scheme] of Object.entries(schemes)) {
            if (scheme.isRomanScheme) {
                Sanscript.addRomanScheme(schemeName, scheme);
            }
        }

    }());

    /**
     * Create a map from every character in `from` to its partner in `to`.
     * Also, store any "marks" that `from` might have.
     *
     * @param from     input scheme
     * @param to       output scheme
     * @param options  scheme options
     */
    const makeMap = function (from, to, options) {
        const consonants = {};
        const fromScheme = Sanscript.schemes[from];
        const letters = {};
        const tokenLengths = [];
        const marks = {};
        const accents = {};
        const toScheme = Sanscript.schemes[to];

        const alternates = fromScheme["alternates"] || {};

        for (const group in fromScheme) {
            if (!{}.hasOwnProperty.call(fromScheme, group)) {
                continue;
            }
            if (["alternates", "accented_vowel_alternates", "isRomanScheme"].includes(group)) {
                continue;
            }
            const fromGroup = fromScheme[group];
            const toGroup = toScheme[group];
            if (toGroup === undefined) {
                continue;
            }
            for (const [key, F] of Object.entries(fromGroup)) {
                let T = toGroup[key];
                if (T === undefined) {
                    continue;
                }
                if (T === "" && !["virama", "zwj", "skip"].includes(group)) {
                    T = F;
                }
                const alts = alternates[F] || [];
                const numAlts = alts.length;
                let j = 0;

                tokenLengths.push(F.length);
                for (j = 0; j < numAlts; j++) {
                    tokenLengths.push(alts[j].length);
                }

                if (group === "vowel_marks" || group === "virama") {
                    marks[F] = T;
                    for (j = 0; j < numAlts; j++) {
                        marks[alts[j]] = T;
                    }
                } else {
                    letters[F] = T;
                    for (j = 0; j < numAlts; j++) {
                        letters[alts[j]] = T;
                    }
                    if (group === "consonants" || group === "extra_consonants") {
                        consonants[F] = T;

                        for (j = 0; j < numAlts; j++) {
                            consonants[alts[j]] = T;
                        }
                    }
                    if (group === "accents") {
                        accents[F] = T;

                        for (j = 0; j < numAlts; j++) {
                            accents[alts[j]] = T;
                        }
                    }
                }
            }
        }

        if (fromScheme["accented_vowel_alternates"]) {
            for (const baseAccentedVowel of Object.keys(fromScheme["accented_vowel_alternates"])) {
                const synonyms = fromScheme.accented_vowel_alternates[baseAccentedVowel];
                for (const accentedVowel of synonyms) {
                    const baseVowel = baseAccentedVowel.substring(0, baseAccentedVowel.length - 1);
                    const sourceAccent = baseAccentedVowel[baseAccentedVowel.length - 1];
                    const targetAccent = accents[sourceAccent] || sourceAccent;
                    // Roman a does not map to any brAhmic vowel mark. Hence "" below.
                    marks[accentedVowel] = (marks[baseVowel] || "") + targetAccent;
                    if (!letters[baseVowel]) {
                        console.error(baseVowel, targetAccent, letters);
                    }
                    letters[accentedVowel] = letters[baseVowel].concat(targetAccent);
                }
            }
        }



        return {
            consonants     : consonants,
            accents        : accents,
            fromRoman      : fromScheme.isRomanScheme,
            letters        : letters,
            marks          : marks,
            maxTokenLength : Math.max.apply(Math, tokenLengths),
            toRoman        : toScheme.isRomanScheme,
            virama         : toScheme.virama["्"],
            toSchemeA      : toScheme.vowels["अ"],
            fromSchemeA    : fromScheme.vowels["अ"],
            from           : from,
            to             : to,
        };
    };

    /**
     * Transliterate from a romanized script.
     *
     * @param data     the string to transliterate
     * @param map      map data generated from makeMap()
     * @param options  transliteration options
     * @return         the finished string
     */
    const transliterateRoman = function (data, map, options) {
        const buf = [];
        const consonants = map.consonants;
        const dataLength = data.length;
        const letters = map.letters;
        const marks = map.marks;
        const maxTokenLength = map.maxTokenLength;
        const optSkipSGML = options.skip_sgml;
        const optSyncope = options.syncope;
        const toRoman = map.toRoman;
        const virama = map.virama;

        let hadConsonant = false;
        let tempLetter;
        let tempMark;
        let tokenBuffer = "";

        // Transliteration state. It's controlled by these values:
        // - `skippingSGML`: are we in SGML?
        // - `toggledTrans`: are we in a toggled region?
        //
        // We combine these values into a single variable `skippingTrans`:
        //
        //     `skippingTrans` = skippingSGML || toggledTrans;
        //
        // If (and only if) this value is true, don't transliterate.
        let skippingSGML = false;
        let skippingTrans = false;
        let toggledTrans = false;

        for (let i = 0, L; (L = data.charAt(i)) || tokenBuffer; i++) {
            // Fill the token buffer, if possible.
            const difference = maxTokenLength - tokenBuffer.length;
            if (difference > 0 && i < dataLength) {
                tokenBuffer += L;
                if (difference > 1) {
                    continue;
                }
            }

            // Match all token substrings to our map.
            for (let j = 0; j < maxTokenLength; j++) {
                const token = tokenBuffer.substr(0, maxTokenLength - j);

                if (skippingSGML === true) {
                    skippingSGML = (token !== ">");
                } else if (token === "<") {
                    skippingSGML = optSkipSGML;
                } else if (token === "##") {
                    toggledTrans = !toggledTrans;
                    tokenBuffer = tokenBuffer.substr(2);
                    break;
                }
                skippingTrans = skippingSGML || toggledTrans;
                if ((tempLetter = letters[token]) !== undefined && !skippingTrans) {
                    if (toRoman) {
                        buf.push(tempLetter);
                    } else {
                        // Handle the implicit vowel. Ignore 'a' and force
                        // vowels to appear as marks if we've just seen a
                        // consonant.
                        if (hadConsonant) {
                            if ((tempMark = marks[token])) {
                                buf.push(tempMark);
                            } else if (token !== map.fromSchemeA) {
                                buf.push(virama);
                                buf.push(tempLetter);
                            }
                        } else {
                            buf.push(tempLetter);
                        }
                        hadConsonant = token in consonants;
                    }
                    tokenBuffer = tokenBuffer.substr(maxTokenLength - j);
                    break;
                } else if (j === maxTokenLength - 1) {
                    if (hadConsonant) {
                        hadConsonant = false;
                        if (!optSyncope) {
                            buf.push(virama);
                        }
                    }
                    buf.push(token);
                    tokenBuffer = tokenBuffer.substr(1);
                    // 'break' is redundant here, "j == ..." is true only on
                    // the last iteration.
                }
            }
        }
        if (hadConsonant && !optSyncope) {
            buf.push(virama);
        }
        let result = buf.join("");
        const toScheme = schemes[map.to];
        if (!toRoman && Object.keys(map.accents).length > 0) {
            const pattern = new RegExp(`([${Object.values(map.accents).join("")}])([${Object.values(toScheme['yogavaahas']).join("")}])`, "g");
            result = result.replace(pattern, "$2$1");
        }

        return result;
    };

    /**
     * Transliterate from a Brahmic script.
     *
     * @param data     the string to transliterate
     * @param map      map data generated from makeMap()
     * @param options  transliteration options
     * @return         the finished string
     */
    const transliterateBrahmic = function (data, map, options) {
        const buf = [];
        const consonants = map.consonants;
        const letters = map.letters;
        const marks = map.marks;
        const toRoman = map.toRoman;

        let danglingHash = false;
        let hadRomanConsonant = false;
        let temp;
        let skippingTrans = false;
        const toScheme = schemes[map.to];

        if (toRoman && Object.keys(map.accents).length > 0) {
            const pattern = new RegExp(`([${Object.values(toScheme['yogavaahas']).join("")}])([${Object.values(map.accents).join("")}])`, "g");
            data = data.replace(pattern, "$2$1");
        }

        for (let i = 0, L; (L = data.charAt(i)); i++) {
            // Toggle transliteration state
            if (L === "#") {
                if (danglingHash) {
                    skippingTrans = !skippingTrans;
                    danglingHash = false;
                } else {
                    danglingHash = true;
                }
                if (hadRomanConsonant) {
                    buf.push(map.toSchemeA);
                    hadRomanConsonant = false;
                }
                continue;
            } else if (skippingTrans) {
                buf.push(L);
                continue;
            }

            if ((temp = marks[L]) !== undefined) {
                buf.push(temp);
                hadRomanConsonant = false;
            } else {
                if (danglingHash) {
                    buf.push("#");
                    danglingHash = false;
                }
                if (hadRomanConsonant) {
                    buf.push(map.toSchemeA);
                    hadRomanConsonant = false;
                }

                // Push transliterated letter if possible. Otherwise, push
                // the letter itself.
                if ((temp = letters[L])) {
                    buf.push(temp);
                    hadRomanConsonant = toRoman && (L in consonants);
                } else {
                    buf.push(L);
                }
            }
        }
        if (hadRomanConsonant) {
            buf.push(map.toSchemeA);
        }
        return buf.join("");
    };

    // Normalize iast avagraha (ऽ) characters
    const RE_OTHER_AVAGRAHA = /[‘’]/g;
    // Remove ligature characters for devanagari
    const RE_REMOVE_LIGATURE = /[-]/g;
    // Convert punctuations to '.' for devanagari
    const RE_ALTERNATE_PUNC = /(^|[^#\\])[,?!:]/g;
    // Keep dot ('1.2' or '||1.2||' form) in devanagari charter numbers
    const RE_REMAIN_NUM_DOT = /\d\.\d/g;

    // Match on IAST vowel character for aksara(syllable)
    // Anusvāra and visarga share the same syllable as the preceding vowel
    const RE_AKSARA_VOWEL = /[aiuāīūṛṝḷḹáíúeēèoōò]+[ṃḥ]?/i;

    // Match on the aksara which ends with vowel character
    const RE_END_VOWEL = /[aiuāīūṛṝḷḹáíúeēèoōò]$/i;
    // Match characters that belong to the same syllable or number
    const RE_AKSARA_PUNC_NUM = /[▷,?!:]|\|+\d[|\d.-]*|\|+|\d[\d.-]*/g;
    // Match on IAST characters in a consonant
    const RE_CONSONANT2 = /kṣ|jñ|ll|[kgcjṭḍtdpb]h?|[ṅñṇnmyrlvśṣsh]/gi;
    const RE_CONSONANT1 = /[kgcjṭḍtdpbṅñṇnmyrlvśṣsh]/i;
    // Match in getAksaraType
    const RE_AKSARA_TYPE_NUM = /[\d०-९]/;
    const RE_AKSARA_TYPE_PUNC = /^[,.?!:|।॥]/;
    const RE_AKSARA_CONS_HELP = [/[\t'-]/g, /^\t+/];

    // If audio mark after number or punctuation, then keep them together
    const RE_PUNC_AUDIO_TOGETHER = /(\|+\d[\d.-]*\|+|[|,?!:]+)▷/g;
    // Match on audio mark and audio number
    const RE_AUDIO_WITH_NUM = /▷\d+[a-z]?|▷\d*/g;
    // Match on space between audio mark and ligature character
    const RE_AUDIO_SPACE_DASH = /▷\s+-/g;

    /**
     * Detect the consonant sy[i] is at end or not
     * @param {string[]} sy     syllables
     * @param {number} i        index of the consonant char
     * @returns {boolean}
     */
    const isConsonantAtEnd = function (sy, i) {
        return i === sy.length - 1 ||
            RE_AKSARA_TYPE_NUM.test(sy[i + 1]) ||
            RE_AKSARA_TYPE_PUNC.test(sy[i + 1]) ||
            sy[i + 1] === '▷' && i + 2 < sy.length && isConsonantAtEnd(sy, i + 1);
    };

    /*
     * Split an iast word into aksara texts
     *
     * @param data {string}     iast word string
     * @return {string[]}       each text is aksara, punctuation or number
     */
    Sanscript.splitAksara = function (data) {
        const items = [];
        const split = (str) => {
            while (str) {
                const vowelIndex = str.search(RE_AKSARA_VOWEL);
                if (vowelIndex < 0) {
                    items.push(str); // consonant
                    break;
                }
                str.replace(RE_AKSARA_VOWEL, function (vowel) {
                    const syllable = str.substring(0, vowelIndex + vowel.length);
                    items.push(syllable); // has vowel
                    str = str.substring(vowelIndex + vowel.length);
                    return ''; // not used
                });
            }
        };
        let idx = 0;

        data.split(RE_AKSARA_PUNC_NUM).forEach((sentence) => {
            split(sentence);
            idx += sentence.length;

            let punc = data[idx];
            if (punc) { // Add punctuation or number
                if (/[|\d]/.test(data[idx++])) { // eg:  ||3||  1.2
                    const re = punc === '|' ? /[|\d.-]/ : /[\d.-]/;
                    while (re.test(data[idx])) {
                        punc += data[idx++];
                    }
                }
                items.push(punc);
            }
        });

        return items;
    };

    /**
     * Get item type of splitAksara result
     *
     * @param {string} text   result item from splitAksara, such as 'am', 'Pu\tnā'
     * @returns {string}      'p': punctuation, 'n': number, 'u': audio marker
     *      aksara:  '0': no consonant, '1': consonant, '2': consonant cluster
     *               '4': only vowel, '5': consonant + vowel, '6': consonants + vowel
     */
    Sanscript.getAksaraType = function (text) {
        if (!text) return ' ';
        if (text.indexOf('\t') >= 0) { // an aksara
            return text.split('\t').map(Sanscript.getAksaraType).join('');
        }
        if (text[0] === '▷') return 'u';
        if (RE_AKSARA_TYPE_NUM.test(text)) return 'n';
        if (RE_AKSARA_TYPE_PUNC.test(text)) return 'p';

        const hasVowel = RE_AKSARA_VOWEL.test(text);
        const con = text.replace(RE_AKSARA_CONS_HELP[0], '')
            .replace(RE_CONSONANT2, '\t')
            .replace(RE_CONSONANT1, '\t');
        const n = (RE_AKSARA_CONS_HELP[1].exec(con) || [''])[0].length; // count of consonants at head
        return `${(hasVowel ? 4 : 0) + (n > 1 ? 2 : n)}`;
    };

    /**
     * Extract audio numbers from iast string
     *
     * @param audios {string[]} audio numbers for each '▷' marker in data
     * @param text {string}     the input iast string with '▷' character
     * @returns {string} iast string without audio numbers
     */
    Sanscript.pickAudioNumbers = function (audios, text) {
        let idx = 0;
        text.split(RE_AUDIO_WITH_NUM).forEach((seg) => {
            idx += seg.length;
            if (text[idx]) { // ▷
                const re = /\d/.test(text[++idx]) && /[\da-z]/;
                let num = re ? text[idx++] : '';
                while (re && re.test(text[idx] || '')) {
                    num += text[idx++];
                }
                audios.push(num);
            }
        });
        return text.replace(RE_AUDIO_WITH_NUM, '▷');
    };

    /**
     * Refill audio numbers
     *
     * @param audios {string[]} last result of pickAudioNumbers
     * @param index {number}    start index of audios
     * @param text {string} string with '▷' marker
     */
    Sanscript.refillAudioNumbers = function (audios, index, text) {
        return text.replace(/▷/g, (s) => s + (audios[index++] || ''));
    };

    /**
     * Transliterate from one script to another.
     *
     * @param {string} data       the string to transliterate
     * @param {string} from       the source script, empty to auto-detect
     * @param {string} to         the destination script
     * @param {object} [options]  transliteration options
     * @returns {string}          the finished string
     */
    Sanscript.t = function (data, from, to, options=null) {
        if (!from) {
            from = Sanscript.detect(data).toLowerCase();
        }
        options = options || {};
        const cachedOptions = cache.options || {};
        const defaults = Sanscript.defaults;
        let hasPriorState = (cache.from === from && cache.to === to);
        let map;

        // Here we simultaneously build up an `options` object and compare
        // these options to the options from the last run.
        for (const key in defaults) {
            if ({}.hasOwnProperty.call(defaults, key)) {
                let value = defaults[key];
                if (key in options) {
                    value = options[key];
                }
                options[key] = value;

                // This comparison method is not generalizable, but since these
                // objects are associative arrays with identical keys and with
                // values of known type, it works fine here.
                if (value !== cachedOptions[key]) {
                    hasPriorState = false;
                }
            }
        }

        if (hasPriorState) {
            map = cache.map;
        } else {
            map = makeMap(from, to, options);
            cache = {
                from    : from,
                map     : map,
                options : options,
                to      : to,
            };
        }

        // Easy way out for "{\m+}", "\", and ".h".
        if (from === "itrans") {
            data = data.replace(/{\\m\+}/g, ".h.N");
            data = data.replace(/\.h/g, "");
            data = data.replace(/\\([^'`_]|$)/g, "##$1##");
        }
        else if (from === "tamil_superscripted") {
            const pattern = "([" + Object.values(schemes["tamil_superscripted"]["vowel_marks"]).join("") + schemes["tamil_superscripted"]["virama"]["्"] + "॒॑" + "]+)([²³⁴])";
            data = data.replace(new RegExp(pattern, "g"), "$2$1");
            console.error("transliteration from tamil_superscripted not fully implemented!");
        }
        else if (from === 'iast' && to === 'devanagari') {
            data = data.replace(RE_OTHER_AVAGRAHA, "'")
                .replace(RE_REMAIN_NUM_DOT, (s) => s.replace('.', '##.##'))
                .replace(RE_REMOVE_LIGATURE, '')
                .replace(RE_ALTERNATE_PUNC, (s) => (s.length > 1 ? s[0] : '') + '|');
        }

        const fromShortcuts = schemes[from]["shortcuts"];
        // console.log(fromShortcuts);
        if (fromShortcuts) {
            for (const key in fromShortcuts) {
                const shortcut = fromShortcuts[key];
                if (key.includes(shortcut)) {
                    // An actually long "key" may already exist in the string
                    data = data.replace(key, shortcut);
                }
                data = data.replace(shortcut, key);
            }
        }

        let result;
        if (map.fromRoman) {
            result = transliterateRoman(data, map, options);
        } else {
            result = transliterateBrahmic(data, map, options);
        }
        // Apply shortcuts
        const toShortcuts = schemes[to]["shortcuts"];
        if (toShortcuts) {
            for (const key in toShortcuts) {
                const shortcut = toShortcuts[key];
                if (shortcut.includes(key)) {
                    // An actually long "shortcut" may already exist in the string
                    result = result.replace(shortcut, key);
                }
                result = result.replace(key, shortcut);
            }
        }
        if (to === "tamil_superscripted") {
            const pattern = "([²³⁴])([" + Object.values(schemes["tamil_superscripted"]["vowel_marks"]).join("") + schemes["tamil_superscripted"]["virama"]["्"] + "॒॑" + "]+)";
            result = result.replace(new RegExp(pattern, "g"), "$2$1");
        }

        if (typeof options.preferred_alternates[to] === "object") {
            const keys = Object.keys(options.preferred_alternates[to]);
            for (let i = 0; i < keys.length; i++)
            {
                result = result.split(keys[i]).join(options.preferred_alternates[to][keys[i]]);
            }
        }

        return result;
    };

    // Combine adjacent consonants into consonant cluster
    // Example: ['pā','n','▷','-na'] → ['pā','▷','-nna']
    const combineAdjacentConsonants = function (syllables, sy2, options) {
        for (let i = sy2.length - 2, i0 = i; i >= 0; --i, --i0) {
            const leftIdx = sy2[i] === '▷' ? i - 1 : i;
            const left = (sy2[leftIdx] || '').replace(/^-|-$/g, '');
            const rtIdx = sy2[i + 1] === '▷' ? i + 2 : i + 1;
            const right = sy2[rtIdx] || '';
            const rtConIdx = right.search(RE_CONSONANT2);
            const rtBeginCon = rtConIdx === 0 || rtConIdx === 1 && right[0] === '-';
            const leftI0 = syllables[i0] === '▷' ? i0 - 1 : i0;

            // If left syllable has only consonant (one character)
            if (left.length === 1 && RE_CONSONANT1.test(left)) {
                // And right syllable starts with consonant, then merge left into right syllable
                if (rtBeginCon && syllables[i0] === sy2[i]) {
                    sy2[rtIdx] = (rtConIdx > 0 ? '-' : '') + left + right.substring(rtConIdx);
                    sy2.splice(leftIdx, 1); // remove left
                    if (syllables[leftI0] === left && RE_END_VOWEL.test(syllables[leftI0 - 1] || '')) {
                        syllables[leftI0 - 1] += left;
                        syllables.splice(leftI0, 1);
                    }
                    i0 -= leftIdx === i ? 1 : 2; // skip the syllable which sames as left
                    i -= leftIdx === i ? 1 : 2; // removed at leftIdx, i >= leftIdx
                    continue;
                }
            }
            // If left syllable ends with vowel
            else if (options.move_consonant && RE_END_VOWEL.test(left) && rtBeginCon) {
                // If right syllable begins with consonant cluster
                const rType = Sanscript.getAksaraType(right.substring(rtConIdx));
                const rtI0 = syllables[i0 + 1] === '▷' ? i0 + 2 : i0 + 1;
                if (rType === '2' || rType === '6') {
                    const leadCon = RE_CONSONANT2.exec(right.substring(rtConIdx))[0];
                    if (syllables[rtI0].indexOf(leadCon) === rtConIdx &&
                        leadCon.length === 1 && /[ṅñṇnmrśṣsh]/.test(leadCon)) {
                        syllables[rtI0] = syllables[rtI0].replace(leadCon, '');
                        syllables[leftI0] += leadCon;
                        if (!syllables[rtI0]) {
                            syllables.splice(rtI0, 1);
                        }
                    }
                }
            }

            if (sy2[i] === '▷') { // left==sy2[i-1], [i-1] processed
                i--;
                i0--;
            }
        }
    };

    /**
     * A function to transliterate each word, for the benefit of script learners.
     *
     * @param {string} data       the string to transliterate
     * @param {string} from       the source script, empty to auto-detect
     * @param {string} to         the destination script
     * @param {object} [options]  transliteration options
     * @returns {Array[]}         the finished [word, result] array
     */
    Sanscript.transliterateWordwise = function (data, from, to, options=null) {
        const hasAudio = data.indexOf('▷') >= 0;
        options = options || {};
        if (hasAudio) {
            data = data.replace(RE_PUNC_AUDIO_TOGETHER, (s) => ' ' + s)
                .replace(RE_AUDIO_SPACE_DASH, (s) => s.replace(/\s+/, ''));
        }
        const words = data.split(/\s+/);
        const word_tuples = words.filter((w) => w).map(function (word) {
            if (options.split_aksara || hasAudio) {
                const syllables = Sanscript.splitAksara(word);
                for (let i = syllables.length - 1; i > 0; --i) {
                    // The end consonant share the same syllable as the preceding vowel
                    if (syllables[i].length === 1 && RE_CONSONANT1.test(syllables[i]) &&
                        RE_END_VOWEL.test(syllables[i - 1]) && isConsonantAtEnd(syllables, i)) {
                        syllables[i - 1] += syllables[i];
                        syllables.splice(i, 1);
                    }
                }

                const sy2 = syllables.slice(); // syllables for conversion target
                combineAdjacentConsonants(syllables, sy2, options);

                const result = sy2.map((aksara) => Sanscript.t(aksara, from, to, options));
                // Separate each aksara with tab
                return [syllables.join(options.split_aksara ? '\t' : ''),
                    result.join(options.split_aksara ? '\t' : '')];
            }
            const result = Sanscript.t(word, from, to, options);
            return [word, result];
        });
        return word_tuples.filter((t) => t[0].length);
    };


    // Now that Sanscript is fully defined, we now safely export it for use elsewhere.
    // The below block was copied from https://www.npmjs.com/package/sanscript .
    // define seems to be a requirejs thing https://requirejs.org/docs/whyamd.html#amd .
    if (typeof define === "function" && define.amd) {
        define(function () {
            return Sanscript;
        });
    } else if (typeof exports !== "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            exports = Sanscript;
            module.exports = Sanscript;
        }

        exports.Sanscript = Sanscript;
    } else {
        global.Sanscript = Sanscript;
    }
}

// The below comment avoids jslint failure.
/* global schemes devanagariVowelToMarks*/
exportSanscriptSingleton(this, schemes, devanagariVowelToMarks);

(() => {
  'use strict';

  // Pokémon 第8世代以降の入力制限を参考にした、クライアント側の事前判定。
  // 単純な部分一致による誤判定を避けるため、語ごとに「含む」「完全一致」「語尾一致」を分ける。
  // オンライン公開時は、同等以上の判定を必ずサーバー側でも行う。
  const JAPANESE_CONTAINS = [
    'あなる', 'いらまちお', 'おっぱい', 'おまんこ', 'せいえき', 'ふぁっく',
    'うんこ', 'うんち', 'おしっこ', 'おなにー', 'おなる', 'おめこ', 'がいじ',
    'きちがい', 'きんたま', 'くろんぼ', 'くりとりす', 'けつあな', 'ごうかん',
    'ざーめん', 'せっくす', 'ちんこ', 'ちんちん', 'ちんぽ', 'にがー', 'にぐろ',
    'ふぇら', 'ぺにす', 'まんこ', 'めくら', 'りょうじょく', 'れいぷ', 'ろりこん',
    'ひとらー', 'なちす', 'ころして', 'しんで', 'じさつしろ'
  ];

  const JAPANESE_EXACT = [
    'あほ', 'きえて', 'きえろ', 'くたばれ', 'ころす', 'しね', 'しぬ', 'やらせろ',
    'どかた', 'つんぼ', 'びっこ', 'かたわ', 'ぶらく', 'ちゃんころ'
  ];

  const JAPANESE_SUFFIX = ['しね', 'ころす', 'くたばれ', 'きえろ'];

  const LATIN_CONTAINS = [
    'analplug', 'analsex', 'blowjob', 'bullshit', 'cocksucker', 'cumshot', 'dickhead',
    'ejaculate', 'faggot', 'goddamn', 'handjob', 'jesussucks', 'masturbate', 'paedophile',
    'pedophile', 'pedofile', 'pornography', 'rapist', 'scrotum', 'towelhead', 'vagina',
    'wetback', 'whore', 'nigger', 'nigga', 'fucker', 'motherfucker', 'fascist', 'hitler',
    'nazism', 'suicide', 'incest', 'clitoris', 'dildo', 'fuck', 'cunt'
  ];

  const LATIN_EXACT = [
    'acab', 'anal', 'ass', 'bastard', 'bitch', 'bj', 'chink', 'clit', 'cock', 'coon',
    'cum', 'damn', 'dick', 'dike', 'dyke', 'fag', 'fags', 'fcuk', 'fuct', 'fuk', 'fvck',
    'gook', 'gypo', 'homo', 'hore', 'isis', 'isil', 'jism', 'jizz', 'jizzum', 'kaffir',
    'kike', 'kill', 'killer', 'kkk', 'kunt', 'lesbo', 'molest', 'nazi', 'negro', 'paedo',
    'paki', 'pecker', 'pedo', 'penis', 'phuk', 'piss', 'poof', 'poon', 'porn', 'pussy',
    'rape', 'raped', 'rapes', 'sex', 'shit', 'shiz', 'slag', 'slut', 'spastic', 'spaz',
    'sperm', 'spunk', 'tits', 'twat', 'vag', 'vulva', 'wank', 'wanker', 'wog', 'kz', 'sa', 'ss'
  ];

  const RESERVED_EXACT = [
    'admin', 'administrator', 'moderator', 'official', 'support', 'mulrate',
    '運営', '管理者', '公式', 'サポート'
  ];

  const LEET_TABLE = Object.freeze({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' });

  function toHiragana(value) {
    return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function compact(value) {
    return Array.from(String(value || '').normalize('NFKC').toLowerCase())
      .filter((char) => /[\p{L}\p{N}]/u.test(char))
      .join('');
  }

  function latinSkeleton(value) {
    return value.replace(/[0134578]/g, (char) => LEET_TABLE[char] || char);
  }

  function findMatch(value) {
    const rawCompact = compact(value);
    const japanese = toHiragana(rawCompact);
    const latin = latinSkeleton(rawCompact);

    if (!rawCompact) return null;
    if (RESERVED_EXACT.includes(rawCompact) || RESERVED_EXACT.includes(japanese)) return { category: 'reserved' };
    if (JAPANESE_EXACT.includes(japanese)) return { category: 'inappropriate' };
    if (JAPANESE_CONTAINS.some((word) => japanese.includes(word))) return { category: 'inappropriate' };
    if (JAPANESE_SUFFIX.some((word) => japanese.length > word.length && japanese.endsWith(word))) return { category: 'inappropriate' };
    if (LATIN_EXACT.includes(latin)) return { category: 'inappropriate' };
    if (LATIN_CONTAINS.some((word) => latin.includes(word))) return { category: 'inappropriate' };
    return null;
  }

  window.MulRateNameFilter = Object.freeze({
    isAllowed(value) {
      return !findMatch(value);
    },
    validate(value) {
      const match = findMatch(value);
      return match
        ? { ok: false, code: match.category === 'reserved' ? 'RESERVED_NAME' : 'PROHIBITED_WORD' }
        : { ok: true, code: 'OK' };
    }
  });
})();

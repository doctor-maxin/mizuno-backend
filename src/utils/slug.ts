function transliterate(text: string): string {
    const cyrillicToLatinMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
      'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return text.split('').map(char => cyrillicToLatinMap[char.toLowerCase()] || char).join('');
  }

  export function createSlug(input: string): string {
    let slug = transliterate(input);

    slug = slug.toLowerCase();

    slug = slug.replace(/[\s\_\/]+/g, '-');

    slug = slug.replace(/[^\w\-]+/g, '');

    slug = slug.replace(/\-\-+/g, '-');

    slug = slug.replace(/^-+/, '').replace(/-+$/, '');

    return slug;
  }
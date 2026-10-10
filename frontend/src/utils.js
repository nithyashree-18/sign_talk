// Short label used on buttons and as an image fallback
export const digitOf = (sign) => {
  if (sign.category === "Alphabets") return sign.name.slice(-1).toUpperCase();
  const m = sign.name.match(/\((\d+)\)/);
  return m ? m[1] : sign.name;
};
// رابط واتساب: إذا انطى رقم عراقي يفتح المحادثة وياه، وإلا يختار المستخدم
export function waLink(phone: string | null | undefined, text: string) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "964" + digits.slice(1);
  return `https://wa.me/${digits.length >= 11 ? digits : ""}?text=${encodeURIComponent(text)}`;
}

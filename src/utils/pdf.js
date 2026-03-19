import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const generateEstimatePdfFromElement = async (element, fileName = "클린철거_견적서.pdf") => {
  if (!element) {
    alert("견적서 영역을 찾을 수 없습니다.");
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = 210;
  const pageHeight = 297;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
};

export const calculateEstimateAmounts = (items = []) => {
  const supplyAmount = items.reduce((sum, item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    return sum + price * quantity;
  }, 0);

  const vat = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  return {
    supplyAmount,
    vat,
    totalAmount,
  };
};
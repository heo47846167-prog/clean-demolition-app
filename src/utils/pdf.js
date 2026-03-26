import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const formatPdfNumber = (value = 0) => {
  return Number(value || 0).toLocaleString("ko-KR");
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

export const buildEstimateSummary = (items = []) => {
  const { supplyAmount, vat, totalAmount } = calculateEstimateAmounts(items);

  return {
    supplyAmount,
    vat,
    totalAmount,
    supplyAmountText: `${formatPdfNumber(supplyAmount)}원`,
    vatText: `${formatPdfNumber(vat)}원`,
    totalAmountText: `${formatPdfNumber(totalAmount)}원`,
  };
};

export const generateEstimatePdfFromElement = async (
  element,
  fileName = "클린철거_견적서.pdf"
) => {
  if (!element) {
    alert("견적서 영역을 찾을 수 없습니다.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 0;

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error("PDF 생성 실패:", error);
    alert("PDF 생성 중 오류가 발생했습니다.");
  }
};
<div className="estimate-footer">
  <div>클린철거 Clean Demolition</div>
  <div>Tel. 031-291-2133</div>
</div>

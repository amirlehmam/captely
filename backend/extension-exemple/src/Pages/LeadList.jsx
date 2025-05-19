/* eslint-disable no-undef */
import { useState } from "react";
import Papa from "papaparse";
const LeadList = () => {
  const [csvData, setCsvData] = useState("");
  const [tableSheetCount, setTableSheetCount] = useState(0);

  const fetchLeadData = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const response = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const tableElement = document.querySelector("table");
          if (tableElement) {
            return {
              tableHTML: tableElement.outerHTML,
            };
          }
          return { tableHTML: "No table found" };
        },
      });

      const data = response[0].result;

      if (data.tableHTML !== "No table found") {
        convertTableToCsv(data.tableHTML);
      }
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const convertTableToCsv = async (tableHTML) => {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = tableHTML;

      const table = tempDiv.querySelector("table");
      const headers = Array.from(table.querySelectorAll("thead th"));
      const rows = Array.from(table.querySelectorAll("tbody tr"));

      const headerArray = headers.map((header) => header.textContent.trim());

      // Insert "Designation" header after "Name"
      headerArray.splice(1, 0, "Profile URL");
      headerArray.splice(2, 0, "Designation");

      const outreachActivityIndex = headerArray.indexOf("Outreach activity");

      // Extract rows
      const dataArray = rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));

        const nameCell = cells[0]?.querySelector("a span");
        const name = nameCell ? nameCell.textContent.trim() : "Name not found";

        const profileLinkElement = cells[0]?.querySelector("a");
        const profileLink = profileLinkElement
          ? profileLinkElement.getAttribute("href")
          : "Link not found";

        const designationCell = cells[0]?.querySelector(
          "div[data-anonymize='job-title']"
        );
        const designation = designationCell
          ? designationCell.textContent.trim()
          : "Designation not found";

        const outreachActivityCell = cells[
          outreachActivityIndex - 2
        ]?.querySelector("button span.lists-table__outreach-activity-text");
        const outreachActivity = outreachActivityCell
          ? outreachActivityCell.textContent.trim()
          : "Outreach Activity Not Found";

        const rowData = cells.map((cell, index) => {
          // Replace dynamic columns with extracted data
          if (index === 0) return name;
          if (index === outreachActivityIndex - 2) return outreachActivity;
          return cell.textContent.trim();
        });

        rowData.splice(1, 0, `https://www.linkedin.com${profileLink}`);
        rowData.splice(2, 0, designation);

        return rowData;
      });

      const previousData = await new Promise((resolve) => {
        chrome.storage.local.get(["scrapedData"], (result) => {
          resolve(result.scrapedData || []);
        });
      });

      const isHeaderIncluded =
        previousData.length > 0 &&
        previousData[0].every((header, index) => header === headerArray[index]);

      const combinedData = isHeaderIncluded
        ? [...previousData, ...dataArray]
        : [headerArray, ...previousData, ...dataArray];

      chrome.storage.local.set({ scrapedData: combinedData });

      setTableSheetCount(combinedData.length - 1);
    } catch (error) {
      console.error("Error converting table to CSV", error);
    }
  };

  const unperseData = async () => {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(["scrapedData"], (result) => {
        resolve(result.scrapedData || []);
      });
    });

    if (data.length > 0) {
      const csv = Papa.unparse(data);
      setCsvData(csv);
    } else {
      console.error("No data available to convert to CSV");
    }
  };

  const downloadCsv = () => {
    if (!csvData) {
      console.error("No CSV data available for download");
      return;
    }

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "linkedin_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    clearData();
  };

  const clearData = () => {
    chrome.storage.local.remove("scrapedData", () => {
      setCsvData("");
      setTableSheetCount(0);
    });
  };

  return (
    <div className="p-2 space-y-3">
      <h1 className="text-medium text-sm flex gap-2 items-center justify-center">
        <span className="h-1 w-1 rounded-full bg-black"></span>
        <span>
          Scrap data from{" "}
          <a
            href="https://www.linkedin.com/sales/lists/people"
            target="_blank"
            className="text-blue-400 underline font-medium"
          >
            Lead List
          </a>{" "}
          & select your list
        </span>
      </h1>
      <div className="text-center">
        <button
          onClick={fetchLeadData}
          className="py-2 px-4 bg-sky-600 rounded-lg cursor-pointer text-white"
        >
          Scrap This Table
        </button>
        {tableSheetCount > 0 && (
          <button
            onClick={unperseData}
            className="py-2 px-4 bg-sky-600 rounded-lg cursor-pointer text-white mt-3"
          >
            Convert to CSV
          </button>
        )}
        <p className="my-2 text-blue-700">Total Rows: {tableSheetCount}</p>

        {csvData && (
          <div className="flex flex-col gap-2">
            <button
              onClick={downloadCsv}
              className="py-2 px-4 bg-green-600 rounded-lg cursor-pointer text-white"
            >
              Download CSV
            </button>
            <button
              onClick={clearData}
              className="py-2 px-4 bg-red-600 rounded-lg cursor-pointer text-white"
            >
              Clear Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadList;

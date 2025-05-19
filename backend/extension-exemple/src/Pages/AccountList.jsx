/* eslint-disable no-undef */
import { useState } from "react";
import { IoArrowDownCircleSharp, IoWarning } from "react-icons/io5";
import Papa from "papaparse";

const AccountList = () => {
  const [csvData, setCsvData] = useState("");
  const [tableSheetCount, setTableSheetCount] = useState(0);

  const fetchListData = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const response = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Select all list items
          const listItems = document.querySelectorAll(
            ".artdeco-list .artdeco-list__item"
          );
          const extractedData = Array.from(listItems).map((item) => {
            // Helper function to add only valid fields
            const addIfExists = (key, value) =>
              value ? { [key]: value.trim() } : {};

            // Extract data from the list item
            const nameElement = item.querySelector(
              ".artdeco-entity-lockup__title a"
            );
            const name = nameElement ? nameElement.textContent.trim() : null;

            const profileLink = nameElement
              ? `https://www.linkedin.com${nameElement.getAttribute("href")}`
              : null;

            const industryElement = item.querySelector(
              ".artdeco-entity-lockup__subtitle span[data-anonymize='industry']"
            );
            const industry = industryElement
              ? industryElement.textContent.trim()
              : null;

            const employeesElement = item.querySelector(
              "a.li-i18n-linkto._view-all-employees_1derdc"
            );
            const employees = employeesElement
              ? employeesElement.textContent.trim()
              : null;

            const aboutElement = item.querySelector(
              "dd.t-12.t-black--light.mb3 div span:nth-child(2)"
            );
            const about = aboutElement
              ? aboutElement.textContent.trim().replace("…see more", "").trim()
              : null;

            const designationElement = item.querySelector(
              ".artdeco-entity-lockup__subtitle span[data-anonymize='title']"
            );
            const designation = designationElement
              ? designationElement.textContent.trim()
              : null;

            const organizationElement = item.querySelector(
              ".artdeco-entity-lockup__subtitle a[data-anonymize='company-name']"
            );
            const organization = organizationElement
              ? organizationElement.textContent.trim()
              : null;

            const organizationUrl = organizationElement
              ? `https://www.linkedin.com${organizationElement.getAttribute(
                  "href"
                )}`
              : null;

            const locationElement = item.querySelector(
              ".artdeco-entity-lockup__caption span[data-anonymize='location']"
            );
            const location = locationElement
              ? locationElement.textContent.trim()
              : null;

            return {
              ...addIfExists("Name", name),
              ...addIfExists("ProfileURL", profileLink),
              ...addIfExists("Industry", industry),
              ...addIfExists("Employees", employees),
              ...addIfExists("About", about),
              ...addIfExists("Designation", designation),
              ...addIfExists("Organization", organization),
              ...addIfExists("OrganizationURL", organizationUrl),
              ...addIfExists("Location", location),
            };
          });

          return extractedData;
        },
      });

      const newData = response[0].result;
      chrome.storage.local.get("scrapedListData", (result) => {
        const existingData = result.scrapedListData || [];
        const combinedData = [...existingData, ...newData]; // Combine old and new data

        // Save the combined data back to storage
        chrome.storage.local.set({ scrapedListData: combinedData }, () => {
          const csv = (() => {
            // Extract all the keys from `combinedData` and check which columns are not empty
            const nonEmptyColumns = [
              "Name",
              "ProfileURL",
              "Location",
              "Industry",
              "Employees",
              "Designation",
              "Organization",
              "OrganizationURL",
              "About",
            ].filter((column) =>
              combinedData.some(
                (row) => row[column] && row[column].trim() !== ""
              )
            );

            // Generate CSV only for the non-empty columns
            return Papa.unparse(combinedData, {
              columns: nonEmptyColumns,
            });
          })();
          setCsvData(csv);
          setTableSheetCount(combinedData.length);
        });
      });
    } catch (error) {
      console.error("Error scraping list data", error);
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
    chrome.storage.local.remove("scrapedListData", () => {
      setCsvData("");
      setTableSheetCount(0);
      console.log("Scraped data cleared.");
    });
  };

  return (
    <div className="p-2 space-y-3">
      <h1 className="text-medium text-sm flex gap-2 items-center justify-center">
        <span className="h-1 w-1 rounded-full bg-black"></span>
        <span>
          Scrap data from{" "}
          <a
            href="https://www.linkedin.com/sales/search/company"
            target="_blank"
            className="text-blue-400 underline font-medium"
          >
            Account
          </a>{" "}
          & make sure you filtered your account
        </span>
      </h1>

      <div className="flex items-center gap-1">
        <div>
          <IoWarning className="text-yellow-600 text-2xl" />
        </div>
        <div>
          <h5 className="text-sm text-[#1f476f] font- tracking-wider inline">
            Please Scroll the page to bottom{" "}
            <span className="font-bold">first </span>
          </h5>
          <IoArrowDownCircleSharp className="text-2xl inline animate-bounce mx-2" />
          <h5 className="text-sm text-[#1f476f] font- tracking-wider inline">
            & make sure you load all data on your screen
          </h5>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={fetchListData}
          className="py-2 px-4 bg-sky-600 rounded-lg cursor-pointer text-white"
        >
          Scrap This Table
        </button>
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
export default AccountList;

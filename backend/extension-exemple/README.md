# Linkedin Sales Navigator Data Scraper Chrome Extension

This project is a Chrome extension designed to scrape data from LinkedIn's Sales Navigator. It extracts relevant information such as names, profile URLs, industries, employee counts, and more, and allows users to download the data in CSV format. The extension is built using React and leverages Chrome's scripting and storage APIs for data extraction and management.

## Features

- **Scrape Account Data**: Extract detailed information from LinkedIn's Sales Navigator Account pages, including names, profile URLs, industries, employee counts, and more.
- **Scrape Lead List Data**: Extract data from LinkedIn's Sales Navigator Lead List pages, including names, profile URLs, designations, and outreach activities.
- **CSV Export**: Convert scraped data into CSV format for easy analysis and storage.
- **Chrome Storage Integration**: Save scraped data locally within the Chrome browser for later retrieval.
- **User-Friendly Interface**: Simple and intuitive UI for easy navigation and operation.

## Demo

Watch the video below to see how the extension works:

<!-- [![Watch the Demo](https://img.youtube.com/vi/ot-tsl-Q4Bs/0.jpg)](https://youtu.be/ot-tsl-Q4Bs) -->

<a href="https://youtu.be/ot-tsl-Q4Bs" target="_blank">
   <img src="./public/images/linkedin_scrapper_tutorial.jpg" alt="linkedin_scrapper_tutorial.jpg" width="600" height="240" />
</a>

## Installation Guide

### Option 1: Use Pre-Built Extension (No Modifications Needed)

1. **Download the Project**:

   - Download the project as a `.zip` file from the repository.
   - Unzip the folder to a location on your computer.
     <br/>
     <img width="500" height="250" alt="likedin data scrapper extension" src="./public/images/download_linkedin_scrapper_zip.png" />

2. **Load the Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** and select the `dist` folder from the unzipped project.
     <br>
     <img width="480" height="300" alt="load likedin data scrapper extension" src="./public/images/upload_extension.png" />
     <br>
   - The extension is now ready to use!
     <br>
     <img width="450" height="220" alt="likedin sales navigator data scrapper extension" src="./public/images/linkedin_sales_navigator_scrapper.png" />

---

### Option 2: Build the Extension from Source (For Modifications)

#### Prerequisites:

Before installing the extension, ensure you have the following:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- Google Chrome browser

#### Instructions:

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/qtecsolution/Linkedin-Sales-Navigator-Scraper.git
   cd Linkedin-Sales-Navigator-Scraper

   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Make Modifications (Optional)**:

   - Modify the code as needed for your use case.

4. **Build the Extension**:

   ```bash
   npm run build
   ```

   - This generates the `dist` folder containing the built extension.

5. **Load the Extension in Chrome**:

   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** and select the `dist` folder from the project.

   The extension is now ready to use with your changes.

## Usage

1. **Navigate to LinkedIn**:

   - Open LinkedIn Sales Navigator and navigate to either the **Account** or **Lead List** page you wish to scrape.

    <img width="450" height="220" alt="likedin data scrapper extension" src="./public/images/linkedin_scrapper_using_extension.png" />

2. **Scrape Data**:

   - Click on the extension icon in the Chrome toolbar.
   - Select either **Scrap This Table** for Account data or **Scrap This Table** for Lead List data.
   - Ensure you scroll to the bottom of the page to load all data before scraping.

3. **Download CSV**:

   - After scraping, click **Download CSV** to save the data to your computer.

4. **Clear Data**:

   - Use the **Clear Data** button to remove all scraped data from the extension's storage.

## Contribute

This is an open source project and contributions are welcome. If you are interested in contributing, please follow this steps:

1. **Fork the Repository**:

   - Fork the project on GitHub.

2. **Create a Branch**:

   - Create a new branch for your feature or bug fix.

   ```bash
   git checkout -b feature/your-feature-name

   ```

3. **Submit a Pull Request**:

   - Open a pull request from your branch to the main repository. Provide a detailed description of your changes.

   <b>Our Team will review and merge your request</b>

## Troubleshooting

#### Extension Not Loading

- Ensure you have enabled **Developer mode** in `chrome://extensions/`.
- Make sure you are selecting the correct `dist` folder after building the project.

#### Data Not Scraping

- Ensure you are on a valid LinkedIn Sales Navigator page (Account or Lead List).
- Scroll to the bottom of the page to load all data before scraping.

#### Build Errors

- Ensure all dependencies are installed by running `npm install`.
- Check for any syntax errors or missing files in your code.

## Notes

- Ensure you comply with LinkedIn's [Terms of Service](https://www.linkedin.com/legal/user-agreement) when using this extension.
- This extension is intended for educational and ethical use only.

## FAQs

### Q1. Can I use this extension on other LinkedIn pages?

**Ans:** No, this extension is specifically designed for LinkedIn Sales Navigator (Account and Lead List pages).

### Q2. Is this extension safe to use?

**Ans:** Yes, the extension runs locally in your browser and does not send data to external servers. However, always ensure you comply with LinkedIn's Terms of Service.

### Q3. Can I modify the CSV output format?

**Ans:** Yes, you can modify the code in the `src` folder to customize the CSV output. After making changes, rebuild the extension using `npm run build`.

## Changelog

### v1.0.0 (Initial Release)

- Added support for scraping Account and Lead List data.
- Implemented CSV export functionality.
- Integrated Chrome storage for local data saving.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, feel free to reach out through the following channels:

- Open an issue on the [GitHub repository](https://github.com/qtecsolution/Linkedin-Sales-Navigator-Scraper).
- **Call for Queries**: +8801313522828 (WhatsApp)
- **Contact Form**: [Qtec Solution Contact Page](https://qtecsolution.com/contact-us)
- **Email**: [info@qtecsolution.com](mailto:info@qtecsolution.com)

## Follow Us on Social Media

Stay updated with the latest news, updates, and releases:

![Qtec Solution Limited.](https://raw.githubusercontent.com/qtecsolution/qtecsolution/refs/heads/main/QTEC-Solution-Limited.png) <br>
[![View Portfolio](https://img.shields.io/badge/View%20Portfolio-%230077B5?style=for-the-badge&logo=portfolio&logoColor=white)](https://qtecsolution.com/Qtec-Solution-Limited-Portfolio.pdf)
[![Facebook](https://img.shields.io/badge/Facebook-4267B2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/QtecSolution/)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/qtecsolution/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/qtec-solution)
[![X](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/qtec_solution)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@qtecsolutionlimited)
[![Website](https://img.shields.io/badge/Website-000000?style=for-the-badge&logo=google-chrome&logoColor=white)](https://qtecsolution.com/)

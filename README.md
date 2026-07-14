# Playwright UI Automation Framework

## 🚀 Overview
This repository contains an end-to-end **UI Automation Framework** built using **Playwright** with **Node.js**. The framework enables fast, reliable, and scalable browser testing across multiple browsers and devices.

## 📂 Folder Structure
```
PlaywrightAutomationFramework/
│── tests/              # Test cases
│── pages/              # Page Object Model (POM) files
│── utils/              # Utility functions
│── test-data/          # Test data files
│── reports/            # Test execution reports
│── playwright.config.ts # Playwright configuration
│── package.json        # Project dependencies and scripts
│── README.md           # Project documentation
```

## 📌 Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/en/download/) (LTS version recommended)
- [Playwright](https://playwright.dev/)

## 🔧 Installation
Clone the repository and install dependencies:
```sh
git clone https://github.com/sunil-bombe/PlaywrightAutomationFramework.git
cd PlaywrightAutomationFramework
npm install
```

## 🎭 Playwright Setup
To install browsers required for testing, run:
```sh
npx playwright install
```

## 🏃 Running Tests
### Run All Tests
```sh
npx playwright test
```

### Run Tests in Headed Mode (UI Mode)
```sh
npx playwright test --headed
```

### Run a Specific Test File
```sh
npx playwright test tests/example.spec.ts
```

### Run Tests with Allure Reporting
```sh
npx playwright test --reporter=allure-playwright
allure generate allure-results --clean && allure open
```

## 📊 Test Reports
- **Playwright HTML Report**
  ```sh
  npx playwright show-report
  ```
- **Allure Report**
  ```sh
  allure generate allure-results --clean && allure open
  ```

## 🏗️ Framework Features
✅ Playwright with **Page Object Model (POM)**  
✅ Supports **Parallel Execution**  
✅ Integrated with **Allure Reporting**  
✅ Configurable via **playwright.config.ts**  
✅ Supports different browsers (**Chromium, Firefox, WebKit**)  
✅ CI/CD Integration Ready  

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -m "Added new feature"`)
4. Push to the branch (`git push origin feature-branch`)
5. Open a Pull Request


## 📞 Contact
For any queries, feel free to reach out:
- **GitHub**: [@sunil-bombe](https://github.com/sunil-bombe)
- **LinkedIn**: [Sunil Bombe](https://www.linkedin.com/in/sunil-bombe-5276b026a/)


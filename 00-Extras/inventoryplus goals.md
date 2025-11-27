**>>Project: InventoryPlus**

**>>Introduction**



I want to build an Inventory management application along with android companion app. I chose working with a modern, full-stack JavaScript environment using React for the frontend, Tailwind CSS for styling, and Google Firestore (via Firebase) for the database, all powered by the Vite build tool.

>>Technology Stack

Frontend	FrameworkReact (with JSX)	Building the component-based user interface and application logic.

Styling		Tailwind CSS	A utility-first CSS framework for rapid, responsive design directly in the JSX files.

Build Tool/Bundler	Vite	A modern, fast development server and build tool that handles HMR (Hot Module Replacement) and bundling.

Database \& Backend	Google Firestore	A NoSQL cloud database used for real-time data synchronization and persistence.

Deployment	TargetTauri 	The configuration shows the project is set up to potentially be bundled into a cross-platform desktop application using Tauri.




**>>End Goals**



An inventory management Windows software without any accounting features for an ecteronic/home appliances business currently having 3 stores and few warehouses. This application is for managing inventory without any accounting/financial features for now. A companion android app for salespersons and other staff for viewing inventory only for now. later we can add more features. 2 to 3 users, with restrictions and roles (explained later), all synced through firebase database, offline viewing capabilities. Every operation manipulating the inventory should be logged and user specific to identify and audit. **I want to keep this application completely free so database queries and sync has to be precise and should use minimal reads/writes possible to keep within free tier limits of firestore database**. 



**>>Main modules of application**



1\. Dashboard >>> work in progress

2\. Products >>> almost done, need some tweaks

3\. Inventory >>> started developing this page

4\. Transactions >>> nothing done, placeholder for now

5\. Reports >>> nothing ddone, placeholder for now

6\. Customers >>> nothing done, placeholder for now

7\. Settings >>> little work done yet





Here are the summary of features I want for each module/page



**1. dashboard**

summary of products based on brands and categories.

Summary of inventory

other useful information

this section will be built after necessary pages, we can decide about the information to show on dashboard later



**2. Products**

This will be the Master Products management page. 

Information to store about a product would be, SKU (unique), Model , Brand, Category, Remarks 

Search and filter functionality Major operation on this page would be ADD , DELTE , EDIT , BULK import (from excel, csv). Deleting a product should be very strict, so that user can not a delete a product if any inventory quantity is attached to it. ability to create brand and category on the fly during add, edit operation. ability to get summary of a specific product's inventory , information from inventory module and relative transaction history. further details can be discussed during building. ability to export full or filtered products data



**3. Inventory module**

This will be the most important module. Mange inventory of products at different stores and warehouses. Major operations would Stock In, Stock Out, Transfer, Bulk inventory import (excel, csv). Inventory records linked to Products by SKU and displayed by mainly 'SKU - Model' attribute of a Product.

Stock In >user adds inventory of selected products to different location, this operation should have option to add inventory of single, or multiple products in one operation. attach location, Reason (pre-defined like sale, purchase, adjustment etc)

Stock Out > similar to Stock In but for deducting stock, timestamps for logging and any other attribute you can think of is necessary.

Transfer > this function is to transfer any stock from one location to the other. any transfer operation should create a notification for concerned user to let him know that some stock was transferred to his assigned locations. ability to export full or filtered products data

any other feature you might think is useful



**4\. Transactions**

this will show all the history of every inventory operation for auditing and to check any mistake, double entry etc.

Log should show details of each transaction including but not limited to user, timestamp, operation type like In Out Transfer Out, Transfer In etc,  you do not have to stick to exactly what I mentioned here, we can discuss it further.



**5\. Reports**
daily, weekly, monthly etc reports in pdf and or excel. 

this is to store and show customer information with not much functionality, later i may want to add WhatsApp messaging, SMS, or any other useful operations to do with customer's data. for now its just to store and display

you can have name, primary contact number, secondary contact number, address, Point of contact (which store this customer usually visits)



**6\. settings**

For now its to keep customer's data in record, I have few things planned for this page for later 



**7\. Settings**

necessary applications, user roles and other settings

1 admin user with full access. admin can add remove users. subsequent users will be appointed to certain locations. every user can see inventory from all locations but can only make Stock In, Stock Out, Transfer only from appointed location. 

currently logged in User related setting like password change etc

visual settings

other required settings you can think of.

**Once again you do not have to strictly follow everything. Offer improvement suggestions at every step of building.**




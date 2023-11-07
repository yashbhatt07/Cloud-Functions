const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const {
  onDocumentUpdated,
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");

const admin = require("firebase-admin");
process.env.GOOGLE_APPLICATION_CREDENTIALS;
setGlobalOptions({ maxInstances: 10 });
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = getFirestore();

async function sendNotification(tokensToSend, title, body) {
  const message = {
    tokens: tokensToSend,
    notification: {
      title,
      body,
    },
    priority: "high",
    android: {
      priority: "high",
      notification: {
        sound: "default",
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };

  try {
    await getMessaging().sendEachForMulticast(message);
    console.log("Sent notification");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Notification send on Paid
exports.paid = onDocumentUpdated(
  "/milestones/{milestonesId}/milestoneInfo/{milestoneInfoId}",
  async (event) => {
    const original = event.data.after.data().paymentStatus;
    // const before = event.data.before.data().paymentStatus;
    const receivedAmount = event.data.after.data().receivedAmount;
    // const originalReceivedAmount = event.data.before.data().receivedAmount;
    // const newReceivedAmount = event.data.after.data().receivedAmount;
    const updatedByUserId = event.data.after.data().updatedByUserId;
    const updatedByUserName = event.data.after.data().updatedByUserName;

    if (original === "fullyPaid" || original === "partiallyPaid") {
      const projectId = event.data.after.data().projectId;
      const projectsRef = admin
        .firestore()
        .collection("projects")
        .doc(projectId);
      try {
        const projectDoc = await projectsRef.get();
        if (projectDoc.exists) {
          const currency = projectDoc.data().currency;
          const projectAvailableFor = projectDoc.data().projectAvailableFor;
          const usersToNotify = projectAvailableFor.filter(
            (userId) => userId !== updatedByUserId
          );
          const eligibleUsers = [];

          let currencySymbol = "";

          if (currency === "dollars") {
            currencySymbol = "$";
          } else if (currency === "rupees") {
            currencySymbol = "₹";
          } else if (currency === "euros") {
            currencySymbol = "€";
          }

          logger.log(
            `We have received ${currencySymbol}${receivedAmount} for project: ${projectName}`
          );

          const usersRef = admin.firestore().collection("users");
          for (const userId of usersToNotify) {
            const userDoc = await usersRef.doc(userId).get();

            if (userDoc.exists && userDoc.data().userId !== updatedByUserId) {
              eligibleUsers.push(userDoc.data());
            }
          }

          const adminUsers = [];
          const adminUsersSnapshotForAdmin = await usersRef
            .where("role", "==", "admin")
            .get();

          adminUsersSnapshotForAdmin.forEach((userDoc) => {
            const userId = userDoc.data().userId;

            if (userId !== updatedByUserId) {
              adminUsers.push(userDoc.data());
            }
          });
          const tokensToSend = [];

          eligibleUsers.concat(adminUsers).forEach((user) => {
            console.log("this is selected users", user);
            const fcmTokens = user.fcmToken;
            console.log("tokens", fcmTokens);
            if (fcmTokens) {
              if (Array.isArray(fcmTokens)) {
                tokensToSend.push(...fcmTokens);
              } else {
                tokensToSend.push(fcmTokens);
              }
            }
          });
          // if (tokensToSend.length > 0) {
          //   const projectName = projectDoc.data().projectName;
          //   const notificationTitle = `${projectName} - Paid`;
          //   const notificationBody = `Payment of ${currencySymbol}${receivedAmount} received (${updatedByUserName})`;

          //   await sendNotification(
          //     tokensToSend,
          //     notificationTitle,
          //     notificationBody
          //   );
          // }
          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,

              notification: {
                title: `${projectName} - Paid`,
                body: `payment of ${currencySymbol}${receivedAmount} received (${updatedByUserName})`,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },

                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log("Sent notification to admins");
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        } else {
          logger.log("Matching project not found.");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
      }
    }
    // else if (original === "partiallyPaid") {
    //   const receivedAmountDifference =
    //     newReceivedAmount !== originalReceivedAmount
    //       ? newReceivedAmount - originalReceivedAmount
    //       : newReceivedAmount;
    //   console.log("old", receivedAmountDifference);
    //   console.log("new", newReceivedAmount);

    //   console.log("total", receivedAmountDifference);
    //   const projectId = event.data.after.data().projectId;
    //   const projectsRef = admin
    //     .firestore()
    //     .collection("projects")
    //     .doc(projectId);

    //   try {
    //     const projectDoc = await projectsRef.get();
    //     if (projectDoc.exists) {
    //       const projectName = projectDoc.data().projectName;
    //       const currency = projectDoc.data().currency;
    //       const projectAvailableFor = projectDoc.data().projectAvailableFor;
    //       const usersToNotify = projectAvailableFor.filter(
    //         (userId) => userId !== updatedByUserId
    //       );
    //       const eligibleUsers = [];

    //       let currencySymbol = "";

    //       if (currency === "dollars") {
    //         currencySymbol = "$";
    //       } else if (currency === "rupees") {
    //         currencySymbol = "₹";
    //       } else if (currency === "euros") {
    //         currencySymbol = "€";
    //       }

    //       const receivedTotalAmounts =
    //         originalReceivedAmount !== 0
    //           ? receivedAmountDifference
    //           : newReceivedAmount;
    //       console.log(
    //         "originalReceivedAmount !== 0:",
    //         originalReceivedAmount !== 0
    //       );
    //       const usersRef = admin.firestore().collection("users");

    //       for (const userId of usersToNotify) {
    //         const userDoc = await usersRef.doc(userId).get();

    //         if (userDoc.exists && userDoc.data().userId !== updatedByUserId) {
    //           eligibleUsers.push(userDoc.data());
    //         }
    //       }
    //       const tokensToSend = [];
    //       const adminUsers = [];

    //       const adminUsersSnapshotForAdmin = await usersRef
    //         .where("role", "==", "admin")
    //         .get();
    //       adminUsersSnapshotForAdmin.forEach((userDoc) => {
    //         const userId = userDoc.data().userId;

    //         if (userId !== updatedByUserId) {
    //           adminUsers.push(userDoc.data());
    //         }
    //       });

    //       eligibleUsers.concat(adminUsers).forEach((user) => {
    //         const fcmTokens = user.fcmToken;
    //         if (fcmTokens) {
    //           if (Array.isArray(fcmTokens)) {
    //             tokensToSend.push(...fcmTokens);
    //           } else {
    //             tokensToSend.push(fcmTokens);
    //           }
    //         }
    //       });

    //       if (tokensToSend.length > 0) {
    //         const message = {
    //           tokens: tokensToSend,
    //           notification: {
    //             title: `${projectName} - Partially Paid`,
    //             body: `Payment of ${currencySymbol}${receivedTotalAmounts} received (${updatedByUserName})`,
    //           },
    //           priority: "high",
    //           android: {
    //             priority: "high",
    //             notification: {
    //               sound: "default",
    //             },
    //           },
    //           apns: {
    //             headers: {
    //               "apns-priority": "10",
    //             },

    //             payload: {
    //               aps: {
    //                 sound: "default",
    //               },
    //             },
    //           },
    //         };

    //         try {
    //           await getMessaging().sendEachForMulticast(message);
    //           console.log("Sent notification to admins");
    //         } catch (error) {
    //           console.error("Error sending notification:", error);
    //         }
    //       }
    //       logger.log(
    //         `We have received ${currencySymbol}${receivedTotalAmounts} for project: ${projectName}`
    //       );
    //     } else {
    //       logger.log("Matching project not found.");
    //     }
    //   } catch (error) {
    //     console.error("Error fetching project:", error);
    //   }
    // }
    else {
      ("No data found");
    }
  }
);

//Notification send on unPaid
exports.unPaid = onDocumentUpdated(
  "/milestones/{milestonesId}/milestoneInfo/{milestoneInfoId}",
  async (event) => {
    const receivedAmount = event.data.after.data().receivedAmount;
    const oldReceivedAmount = event.data.before.data().receivedAmount;
    const newReceivedAmount = event.data.after.data().receivedAmount;
    const updatedByUserId = event.data.after.data().updatedByUserId;
    const updatedByUserName = event.data.after.data().updatedByUserName;
    const projectId = event.data.after.data().projectId;
    const projectsRef = admin.firestore().collection("projects").doc(projectId);

    if (newReceivedAmount < oldReceivedAmount) {
      try {
        const projectDoc = await projectsRef.get();
        if (projectDoc.exists) {
          const projectName = projectDoc.data().projectName;
          const currency = projectDoc.data().currency;
          const projectAvailableFor = projectDoc.data().projectAvailableFor;
          const usersToNotify = projectAvailableFor.filter(
            (userId) => userId !== updatedByUserId
          );
          const eligibleUsers = [];

          let currencySymbol = "";

          if (currency === "dollars") {
            currencySymbol = "$";
          } else if (currency === "rupees") {
            currencySymbol = "₹";
          } else if (currency === "euros") {
            currencySymbol = "€";
          }

          const usersRef = admin.firestore().collection("users");
          for (const userId of usersToNotify) {
            const userDoc = await usersRef.doc(userId).get();

            if (userDoc.exists && userDoc.data().userId !== updatedByUserId) {
              eligibleUsers.push(userDoc.data());
            }
          }

          const adminUsers = [];
          const adminUsersSnapshotForAdmin = await usersRef
            .where("role", "==", "admin")
            .get();

          adminUsersSnapshotForAdmin.forEach((userDoc) => {
            const userId = userDoc.data().userId;

            if (userId !== updatedByUserId) {
              adminUsers.push(userDoc.data());
            }
          });
          const tokensToSend = [];

          eligibleUsers.concat(adminUsers).forEach((user) => {
            console.log("this is selected users", user);
            const fcmTokens = user.fcmToken;
            console.log("tokens", fcmTokens);
            if (fcmTokens) {
              if (Array.isArray(fcmTokens)) {
                tokensToSend.push(...fcmTokens);
              } else {
                tokensToSend.push(fcmTokens);
              }
            }
          });
          let unPaidAmount = oldReceivedAmount - newReceivedAmount;
          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,

              notification: {
                title: `${projectName} - Unpaid`,
                body: `payment of ${currencySymbol}${unPaidAmount} undone (${updatedByUserName})`,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },

                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log("Sent notification to admins");
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        } else {
          logger.log("Matching project not found.");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
      }
    }
  }
);

//Notification send on new project create
exports.newProjectCreated = onDocumentCreated(
  "/projects/{docId}",
  async (event) => {
    const projectId = event.data.data().projectId;
    const projectName = event.data.data().projectName;
    const createdBy = event.data.data().createdBy;
    const createdByName = event.data.data().createdByName;
    const projectAvailableFor = event.data.data().projectAvailableFor;

    if (event) {
      try {
        if (projectAvailableFor) {
          const usersToNotify = projectAvailableFor.filter(
            (userId) => userId !== createdBy
          );
          const eligibleUsers = [];

          const usersRef = admin.firestore().collection("users");
          for (const userId of usersToNotify) {
            const userDoc = await usersRef.doc(userId).get();

            if (userDoc.exists && userDoc.data().userId !== createdBy) {
              eligibleUsers.push(userDoc.data());
            }
          }

          const adminUsers = [];
          const adminUsersSnapshotForAdmin = await usersRef
            .where("role", "==", "admin")
            .get();

          adminUsersSnapshotForAdmin.forEach((userDoc) => {
            const userId = userDoc.data().userId;

            if (userId !== createdBy) {
              adminUsers.push(userDoc.data());
            }
          });
          const tokensToSend = [];

          eligibleUsers.concat(adminUsers).forEach((user) => {
            console.log("this is selected users", user);
            const fcmTokens = user.fcmToken;
            console.log("tokens", fcmTokens);
            if (fcmTokens) {
              if (Array.isArray(fcmTokens)) {
                tokensToSend.push(...fcmTokens);
              } else {
                tokensToSend.push(fcmTokens);
              }
            }
          });

          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,

              notification: {
                title: `${projectName} -  New Project Created`,
                body: `Project added (${createdByName})`,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },

                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log(
                `${projectName} -  New Project Created`,
                `Project added (${createdByName})`
              );
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        } else {
          logger.log("Matching project not found.");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
      }
    }

    return null;
  }
);

//Notification send on milestone update
exports.milestoneupdated = onDocumentUpdated(
  "/milestones/{milestonesId}/milestoneInfo/{milestoneInfoId}",
  async (event) => {
    const updatedByUserId = event.data.after.data().updatedByUserId;
    const updatedByUserName = event.data.after.data().updatedByUserName;
    const oldMilestoneAmount = event.data.before.data().milestoneAmount;
    const UpdatedMilestoneAmount = event.data.after.data().milestoneAmount;
    const beforeMilestoneUpdatedAt = event.data.before.data().updatedAt;
    const afterMilestoneUpdatedAt = event.data.after.data().updatedAt;
    const oldMilestoneDate = new Date(event.data.before.data().milestoneDate);
    const newMilestoneDate = new Date(event.data.after.data().milestoneDate);

    // const oldMilestoneUpdatedAt = new Date(beforeMilestoneUpdatedAt);
    // const newMilestoneUpdatedAt = new Date(afterMilestoneUpdatedAt);
    const formatOptions = {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata", // Set your desired time zone here
    };
    const oldDateString = oldMilestoneDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );
    const newDateString = newMilestoneDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );
    const projectId = event.data.after.data().projectId;
    const projectsRef = admin.firestore().collection("projects").doc(projectId);
    try {
      const projectDoc = await projectsRef.get();
      if (projectDoc.exists) {
        const projectName = projectDoc.data().projectName;
        const currency = projectDoc.data().currency;
        const projectAvailableFor = projectDoc.data().projectAvailableFor;
        const usersToNotify = projectAvailableFor.filter(
          (userId) => userId !== updatedByUserId
        );
        const eligibleUsers = [];

        let currencySymbol = "";

        if (currency === "dollars") {
          currencySymbol = "$";
        } else if (currency === "rupees") {
          currencySymbol = "₹";
        } else if (currency === "euros") {
          currencySymbol = "€";
        }

        const usersRef = admin.firestore().collection("users");
        for (const userId of usersToNotify) {
          const userDoc = await usersRef.doc(userId).get();

          if (userDoc.exists && userDoc.data().userId !== updatedByUserId) {
            eligibleUsers.push(userDoc.data());
          }
        }

        const adminUsers = [];
        const adminUsersSnapshotForAdmin = await usersRef
          .where("role", "==", "admin")
          .get();

        adminUsersSnapshotForAdmin.forEach((userDoc) => {
          const userId = userDoc.data().userId;

          if (userId !== updatedByUserId) {
            adminUsers.push(userDoc.data());
          }
        });
        const tokensToSend = [];

        eligibleUsers.concat(adminUsers).forEach((user) => {
          console.log("this is selected users", user);
          const fcmTokens = user.fcmToken;
          console.log("tokens", fcmTokens);
          if (fcmTokens) {
            if (Array.isArray(fcmTokens)) {
              tokensToSend.push(...fcmTokens);
            } else {
              tokensToSend.push(fcmTokens);
            }
          }
        });
        let notificationTitle = `${projectName} - Milestone updated`;
        let notificationBody = "";

        if (
          UpdatedMilestoneAmount !== oldMilestoneAmount &&
          newDateString !== oldDateString
        ) {
          notificationBody += `Milestone updated - ${currencySymbol}${oldMilestoneAmount} -> ${currencySymbol}${UpdatedMilestoneAmount}, Date ${oldDateString} -> ${newDateString}(${updatedByUserName})`;

          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,
              notification: {
                title: notificationTitle,
                body: notificationBody,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },
                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log("Sent notification to admins");
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        } else if (UpdatedMilestoneAmount !== oldMilestoneAmount) {
          notificationBody += `Milestone updated - ${currencySymbol}${oldMilestoneAmount} -> ${currencySymbol}${UpdatedMilestoneAmount} (${updatedByUserName})`;
          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,
              notification: {
                title: notificationTitle,
                body: notificationBody,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },
                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log("Sent notification to admins");
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        } else if (newDateString !== oldDateString) {
          notificationBody += `Milestone updated -  Date  ${oldDateString} -> ${newDateString} (${updatedByUserName})`;
          if (tokensToSend.length > 0) {
            const message = {
              tokens: tokensToSend,
              notification: {
                title: notificationTitle,
                body: notificationBody,
              },
              priority: "high",
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },
                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            };

            try {
              await getMessaging().sendEachForMulticast(message);
              console.log("Sent notification to admins");
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        }
      } else {
        logger.log("Matching project not found.");
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  }
);

//Notification send on every day at 12 P.M
exports.projectPaymentStatus = onSchedule("0 12 * * *", async (event) => {
  const usersRef = admin.firestore().collection("users");
  const adminUsersQuery = usersRef.where("role", "==", "admin");
  try {
    const adminUsersSnapshot = await adminUsersQuery.get();
    const tokensToSend = [];
    let exceededCount = 0;
    let aboutToExceedCount = 0;
    let adminName;
    const milestoneInfoCollection = db.collectionGroup("milestoneInfo");

    const milestoneInfoDocs = await milestoneInfoCollection.get();

    milestoneInfoDocs.docs.forEach((milestoneInfoDoc) => {
      const milestoneInfoData = milestoneInfoDoc.data();
      console.log("Milestone Info Data:", milestoneInfoData.paymentStatus);

      if (milestoneInfoData.paymentStatus === "aboutToExceed") {
        aboutToExceedCount += 1;
        console.log("aboutToExceedCount", aboutToExceedCount);
      } else if (milestoneInfoData.paymentStatus === "exceeded") {
        exceededCount += 1;
        console.log("exceededCount", exceededCount);
      }
    });

    if (aboutToExceedCount !== 0 || exceededCount !== 0) {
      for (const userDoc of adminUsersSnapshot.docs) {
        const fcmTokens = userDoc.data().fcmToken;
        adminName = userDoc.data().name;
        if (fcmTokens) {
          if (Array.isArray(fcmTokens)) {
            tokensToSend.push(...fcmTokens);
          } else {
            tokensToSend.push(fcmTokens);
          }
        }
      }
    }

    if (tokensToSend.length > 0) {
      const message = {
        tokens: tokensToSend,
        notification: {
          title: `${adminName} - Project Payment Status`,
          body: `Need actions - Invoice (${aboutToExceedCount}) and Payment (${exceededCount})`,
        },
        priority: "high",
        android: {
          priority: "high",
          notification: {
            sound: "default",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },

          payload: {
            aps: {
              sound: "default",
            },
          },
        },
      };
      try {
        await getMessaging().sendEachForMulticast(message);
        console.log("Sent notification to admins");
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
  console.log("User cleanup finished");
});

//Notification send on milestone date
exports.invoiceReminder = onSchedule("0 0 * * *", async (event) => {
  const currentDate = new Date();
  const milestoneInfoCollection = db.collectionGroup("milestoneInfo");
  const milestoneInfoDocs = await milestoneInfoCollection.get();
  milestoneInfoDocs.docs.forEach(async (milestoneInfoDoc) => {
    const milestoneInfoData = milestoneInfoDoc.data();
    const milestoneDate = new Date(milestoneInfoData.milestoneDate);
    const formatOptions = {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    };
    const milestoneDateInFormate = milestoneDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );
    const currentDateInFormate = currentDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );

    if (milestoneDateInFormate === currentDateInFormate) {
      const milestoneAmount = milestoneInfoData.milestoneAmount;
      const projectId = milestoneInfoData.projectId;
      let paymentStatus = milestoneInfoData.paymentStatus;
      const projectRef = admin.firestore().collection("projects");
      const adminProjectsQuery = projectRef.where("projectId", "==", projectId);
      const adminProjectsSnapshot = await adminProjectsQuery.get();

      for (const adminProjectDoc of adminProjectsSnapshot.docs) {
        const bdmUserId = adminProjectDoc.data().bdmUserId;
        const projectName = adminProjectDoc.data().projectName;
        const paymentCycle = adminProjectDoc.data().paymentCycle;
        const currency = adminProjectDoc.data().currency;
        let currencySymbol = "";

        if (currency === "dollars") {
          currencySymbol = "$";
        } else if (currency === "rupees") {
          currencySymbol = "₹";
        } else if (currency === "euros") {
          currencySymbol = "€";
        }

        if (
          paymentCycle !== 0 &&
          paymentCycle !== null &&
          paymentStatus !== "aboutToExceed"
        ) {
          await milestoneInfoDoc.ref.update({
            paymentStatus: "aboutToExceed",
          });
          paymentStatus = "aboutToExceed";

          const usersRef = admin.firestore().collection("users");
          const userQuery = usersRef.where("userId", "==", bdmUserId);
          const userSnapshot = await userQuery.get();
          let tokensToSend = [];

          userSnapshot.forEach(async (userDoc) => {
            const userData = userDoc.data();
            const fcmTokens = userData.fcmToken;
            const role = userData.role;

            if (role === "bdm" && paymentStatus === "aboutToExceed") {
              if (fcmTokens) {
                if (Array.isArray(fcmTokens)) {
                  tokensToSend.push(...fcmTokens);
                } else {
                  tokensToSend.push(fcmTokens);
                }
              }
              if (tokensToSend.length > 0) {
                const message = {
                  tokens: tokensToSend,
                  notification: {
                    title: `${projectName} -  Invoice Reminder`,
                    body: `Invoice of  ${currencySymbol}${milestoneAmount} is due on ${milestoneDateInFormate}`,
                  },
                  priority: "high",
                  android: {
                    priority: "high",
                    notification: {
                      sound: "default",
                    },
                  },
                  apns: {
                    headers: {
                      "apns-priority": "10",
                    },

                    payload: {
                      aps: {
                        sound: "default",
                      },
                    },
                  },
                };

                try {
                  await getMessaging().sendEachForMulticast(message);
                  console.log("Sent notification to BDM");
                } catch (error) {
                  console.error("Error sending notification:", error);
                }
              }
            }
          });
        }
      }
    }
  });
});

// Notification send after complete the payment Cycle.
exports.paymentReminder = onSchedule("0 0 * * *", async (event) => {
  const currentDate = new Date();
  const milestoneInfoCollection = db.collectionGroup("milestoneInfo");
  const milestoneInfoDocs = await milestoneInfoCollection.get();

  milestoneInfoDocs.docs.forEach(async (milestoneInfoDoc) => {
    const milestoneInfoData = milestoneInfoDoc.data();
    const milestoneDate = new Date(milestoneInfoData.milestoneDate);
    const formatOptions = {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    };
    const milestoneDateInFormate = milestoneDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );
    const currentDateInFormate = currentDate.toLocaleDateString(
      "en-IN",
      formatOptions
    );
    const milestoneAmount = milestoneInfoData.milestoneAmount;
    const projectId = milestoneInfoData.projectId;
    let paymentStatus = milestoneInfoData.paymentStatus;

    const projectRef = admin.firestore().collection("projects");
    const adminProjectsQuery = projectRef.where("projectId", "==", projectId);
    const adminProjectsSnapshot = await adminProjectsQuery.get();

    for (const adminProjectDoc of adminProjectsSnapshot.docs) {
      const bdmUserId = adminProjectDoc.data().bdmUserId;
      const projectName = adminProjectDoc.data().projectName;
      const paymentCycle = adminProjectDoc.data().paymentCycle;
      const currency = adminProjectDoc.data().currency;
      let currencySymbol = "";

      if (currency === "dollars") {
        currencySymbol = "$";
      } else if (currency === "rupees") {
        currencySymbol = "₹";
      } else if (currency === "euros") {
        currencySymbol = "€";
      }
      let notificationDate = new Date(milestoneDate);
      const paymentCycleDays = paymentCycle === null ? 0 : paymentCycle;
      if (paymentCycleDays >= 0) {
        notificationDate.setDate(notificationDate.getDate() + paymentCycleDays);
      } else {
        notificationDate.setDate(
          notificationDate.getDate() - Math.abs(paymentCycleDays)
        );
      }

      const notificationDateInFormate = notificationDate.toLocaleDateString(
        "en-IN",
        formatOptions
      );
      if (
        paymentStatus !== "exceeded" &&
        notificationDateInFormate === currentDateInFormate
      ) {
        console.log(
          "milestoneInfoData =>",
          milestoneInfoData,
          "notificationDateInFormate =>",
          notificationDateInFormate,
          "currentDateInFormate =>",
          currentDateInFormate
        );
        await milestoneInfoDoc.ref.update({
          paymentStatus: "exceeded",
        });
        paymentStatus = "exceeded";

        console.log("paymentStatus", paymentStatus);
        const usersRef = admin.firestore().collection("users");
        const userQuery = usersRef.where("userId", "==", bdmUserId);
        const userSnapshot = await userQuery.get();
        const tokensToSend = [];

        userSnapshot.forEach(async (userDoc) => {
          const userData = userDoc.data();
          const fcmTokens = userData.fcmToken;
          const role = userData.role;

          if (role === "bdm" && paymentStatus === "exceeded") {
            if (fcmTokens) {
              if (Array.isArray(fcmTokens)) {
                tokensToSend.push(...fcmTokens);
              } else {
                tokensToSend.push(fcmTokens);
              }
            }

            if (tokensToSend.length > 0) {
              const message = {
                tokens: tokensToSend,
                notification: {
                  title: `${projectName} - Payment Reminder`,
                  body: `Payment of ${currencySymbol}${milestoneAmount} is due on ${notificationDateInFormate}`,
                },
                priority: "high",
                android: {
                  priority: "high",
                  notification: {
                    sound: "default",
                  },
                },
                apns: {
                  headers: {
                    "apns-priority": "10",
                  },

                  payload: {
                    aps: {
                      sound: "default",
                    },
                  },
                },
              };

              try {
                await getMessaging().sendEachForMulticast(message);
                console.log("Sent notification to BDM");
              } catch (error) {
                console.error("Error sending notification:", error);
              }
            }
          }
        });
      }
    }
  });
});

// Send payment received notification to the admins
// exports.sendNotificationToAdmin = onDocumentUpdated(
//   "/milestones/{milestonesId}/milestoneInfo/{milestoneInfoId}",
//   async (event) => {
//     const original = event.data.after.data().paymentStatus;
//     const before = event.data.before.data().paymentStatus;
//     const receivedAmount = event.data.after.data().receivedAmount;
//     const originalReceivedAmount = event.data.before.data().receivedAmount;
//     const newReceivedAmount = event.data.after.data().receivedAmount;
//     const updatedByUserId = event.data.after.data().updatedByUserId;
//     const updatedByUserName = event.data.after.data().updatedByUserName;

//     if (original === "fullyPaid" && original !== before) {
//       const projectId = event.data.after.data().projectId;
//       const projectsRef = admin
//         .firestore()
//         .collection("projects")
//         .doc(projectId);
//       try {
//         const projectDoc = await projectsRef.get();
//         if (projectDoc.exists) {
//           const projectName = projectDoc.data().projectName;
//           const currency = projectDoc.data().currency;
//           let currencySymbol = "";

//           if (currency === "dollars") {
//             currencySymbol = "$";
//           } else if (currency === "rupees") {
//             currencySymbol = "₹";
//           } else if (currency === "euros") {
//             currencySymbol = "€";
//           }

//           logger.log(
//             `We have received ${currencySymbol}${receivedAmount} for project: ${projectName}`
//           );

//           const usersRef = admin.firestore().collection("users");

//           const adminUsersSnapshot = await usersRef.get();
//           const tokensToSend = [];

//           adminUsersSnapshot.forEach((userDoc) => {
//             const fcmTokens = userDoc.data().fcmToken;
//             const userId = userDoc.data().userId;
//             console.log(userDoc.data());
//             if (userId !== updatedByUserId && fcmTokens) {
//               if (Array.isArray(fcmTokens)) {
//                 tokensToSend.push(...fcmTokens);
//               } else {
//                 tokensToSend.push(fcmTokens);
//               }
//             }
//           });

//           if (tokensToSend.length > 0) {
//             const message = {
//               tokens: tokensToSend,
//               notification: {
//                 title: `${projectName} - Paid`,
//                 body: `payment of ${currencySymbol}${receivedAmount} received (${updatedByUserName})`,
//               },
//             };

//             try {
//               await getMessaging().sendEachForMulticast(message);
//               console.log("Sent notification to admins");
//             } catch (error) {
//               console.error("Error sending notification:", error);
//             }
//           }
//         } else {
//           logger.log("Matching project not found.");
//         }
//       } catch (error) {
//         console.error("Error fetching project:", error);
//       }
//     } else if (original === "partiallyPaid") {
//       const receivedAmountDifference =
//         newReceivedAmount !== originalReceivedAmount
//           ? newReceivedAmount - originalReceivedAmount
//           : newReceivedAmount;
//       console.log("old", receivedAmountDifference);
//       console.log("new", newReceivedAmount);

//       console.log("total", receivedAmountDifference);
//       const projectId = event.data.after.data().projectId;
//       const projectsRef = admin
//         .firestore()
//         .collection("projects")
//         .doc(projectId);

//       try {
//         const projectDoc = await projectsRef.get();
//         if (projectDoc.exists) {
//           const projectName = projectDoc.data().projectName;
//           const currency = projectDoc.data().currency;
//           let currencySymbol = "";

//           if (currency === "dollars") {
//             currencySymbol = "$";
//           } else if (currency === "rupees") {
//             currencySymbol = "₹";
//           } else if (currency === "euros") {
//             currencySymbol = "€";
//           }

//           const receivedTotalAmounts =
//             originalReceivedAmount !== 0
//               ? receivedAmountDifference
//               : newReceivedAmount;
//           console.log(
//             "originalReceivedAmount !== 0:",
//             originalReceivedAmount !== 0
//           );
//           const usersRef = admin.firestore().collection("users");
//           const tokensToSend = [];

//           adminUsersQuerySnapshot = await usersRef.get();

//           adminUsersQuerySnapshot.forEach((userDoc) => {
//             console.log("userId", userDoc);
//             const fcmTokens = userDoc.data().fcmToken;
//             console.log("token", fcmTokens);
//             const userId = userDoc.data().userId;
//             console.log("this is the userId", userId);
//             console.log("this is the updatedID", updatedByUserId);

//             if (userId !== updatedByUserId && fcmTokens) {
//               if (Array.isArray(fcmTokens)) {
//                 tokensToSend.push(...fcmTokens);
//               } else {
//                 tokensToSend.push(fcmTokens);
//               }
//             }
//           });

//           if (tokensToSend.length > 0) {
//             const message = {
//               tokens: tokensToSend,
//               notification: {
//                 title: `${projectName} - Partially Paid`,
//                 body: `Payment of ${currencySymbol}${receivedTotalAmounts} received (${updatedByUserName})`,
//               },
//             };

//             try {
//               await getMessaging().sendEachForMulticast(message);
//               console.log("Sent notification to admins");
//             } catch (error) {
//               console.error("Error sending notification:", error);
//             }
//           }
//           logger.log(
//             `We have received ${currencySymbol}${receivedTotalAmounts} for project: ${projectName}`
//           );
//         } else {
//           logger.log("Matching project not found.");
//         }
//       } catch (error) {
//         console.error("Error fetching project:", error);
//       }
//     } else {
//       ("No data found");
//     }
//   }
// );

// Send orange and red count notification every day at 12 P.M to Admins
// exports.everyDayRemainder = onSchedule("0 12 * * *", async (event) => {
//   const usersRef = admin.firestore().collection("users");
//   const adminUsersQuery = usersRef.where("role", "==", "admin");
//   try {
//     const adminUsersSnapshot = await adminUsersQuery.get();
//     const tokensToSend = [];
//     let exceededCount = 0;
//     let aboutToExceedCount = 0;
//     let adminName;
//     const milestoneInfoCollection = db.collectionGroup("milestoneInfo");

//     const milestoneInfoDocs = await milestoneInfoCollection.get();

//     milestoneInfoDocs.docs.forEach((milestoneInfoDoc) => {
//       const milestoneInfoData = milestoneInfoDoc.data();
//       console.log("Milestone Info Data:", milestoneInfoData.paymentStatus);

//       if (milestoneInfoData.paymentStatus === "aboutToExceed") {
//         aboutToExceedCount += 1;
//         console.log("aboutToExceedCount", aboutToExceedCount);
//       } else if (milestoneInfoData.paymentStatus === "exceeded") {
//         exceededCount += 1;
//         console.log("exceededCount", exceededCount);
//       }
//     });

//     if (aboutToExceedCount !== 0 || exceededCount !== 0) {
//       for (const userDoc of adminUsersSnapshot.docs) {
//         const fcmTokens = userDoc.data().fcmToken;
//         adminName = userDoc.data().name;
//         if (fcmTokens) {
//           if (Array.isArray(fcmTokens)) {
//             tokensToSend.push(...fcmTokens);
//           } else {
//             tokensToSend.push(fcmTokens);
//           }
//         }
//       }
//     }

//     if (tokensToSend.length > 0) {
//       const message = {
//         tokens: tokensToSend,
//         notification: {
//           title: `${adminName} - Project Payment Status`,
//           body: `Need actions - Invoice (${aboutToExceedCount}) and Payment (${exceededCount})`,
//         },
//       };
//       try {
//         await getMessaging().sendEachForMulticast(message);
//         console.log("Sent notification to admins");
//       } catch (error) {
//         console.error("Error sending notification:", error);
//       }
//     }
//   } catch (error) {
//     console.error("Error fetching data:", error);
//   }
//   console.log("User cleanup finished");
// });

// Send notification to bdm to send Invoice for the client for the specific project
// exports.sendNotificationToBdm = onDocumentUpdated(
//   "/milestones/{milestonesId}/milestoneInfo/{milestoneInfoId}",
//   async (event) => {
//     try {
//       const paymentStatus = event.data.after.data().paymentStatus;
//       const previousStatus = event.data.before.data().paymentStatus;
//       const milestoneAmount = event.data.before.data().milestoneAmount;
//       const milestoneDate = event.data.after.data().milestoneDate;

//       const projectId = event.data.after.data().projectId;

//       if (paymentStatus === "aboutToExceed" || paymentStatus === "exceeded") {
//         const projectsRef = admin
//           .firestore()
//           .collection("projects")
//           .doc(projectId);
//         const projectDoc = await projectsRef.get();

//         if (projectDoc.exists) {
//           const bdmUserId = projectDoc.data().bdmUserId;
//           const projectName = projectDoc.data().projectName;

//           const usersRef = admin.firestore().collection("users");
//           const userQuery = usersRef.where("userId", "==", bdmUserId);
//           const userSnapshot = await userQuery.get();
//           const tokensToSend = [];

//           userSnapshot.forEach(async (userDoc) => {
//             const userData = userDoc.data();
//             const fcmTokens = userDoc.data().fcmToken;
//             const adminName = userDoc.data().adminName;
//             const role = userDoc.data().role;
//             if (role === "bdm") {
//               if (fcmTokens) {
//                 if (Array.isArray(fcmTokens)) {
//                   tokensToSend.push(...fcmTokens);
//                 } else {
//                   tokensToSend.push(fcmTokens);
//                 }
//               }

//               if (paymentStatus !== previousStatus) {
//                 const NotificationMessage =
//                   paymentStatus === "aboutToExceed"
//                     ? `Send Invoice for this project:${projectName}(Status:${paymentStatus})`
//                     : paymentStatus === "exceeded"
//                     ? `Collect ${milestoneAmount} payment:${projectName}(Status: ${paymentStatus})`
//                     : "";

//                 if (tokensToSend.length > 0) {
//                   const message = {
//                     tokens: tokensToSend,
//                     notification: {
//                       title: `Hello ${adminName}`,
//                       body: NotificationMessage,
//                     },
//                   };

//                   try {
//                     await getMessaging().sendEachForMulticast(message);
//                     console.log("Sent notification to BDM");
//                   } catch (error) {
//                     console.error("Error sending notification:", error);
//                   }
//                 }
//               }
//             } else {
//               ("Role is not a bdm");
//             }
//           });
//         }
//       }
//     } catch (err) {
//       console.log("🚀 ~ file: index.js:310 ~ err:", err);
//     }
//   }
// );

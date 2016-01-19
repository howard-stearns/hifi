//
//  Snapshot.cpp
//  interface/src/ui
//
//  Created by Stojce Slavkovski on 1/26/14.
//  Copyright 2014 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QImage>
#include <QTemporaryFile>
#include <QUrl>

#include <AccountManager.h>
#include <AddressManager.h>
#include <avatar/AvatarManager.h>
#include <avatar/MyAvatar.h>
#include <FileUtils.h>
#include <NodeList.h>

#include "Application.h"
#include "Snapshot.h"

// filename format: hifi-snap-by-%username%-on-%date%_%time%_@-%location%.jpg
// %1 <= username, %2 <= date and time, %3 <= current location
const QString FILENAME_PATH_FORMAT = "hifi-snap-by-%1-on-%2.jpg";

const QString DATETIME_FORMAT = "yyyy-MM-dd_hh-mm-ss";
const QString SNAPSHOTS_DIRECTORY = "Snapshots";

const QString URL = "highfidelity_url";

Setting::Handle<QString> Snapshot::snapshotsLocation("snapshotsLocation",
    QStandardPaths::writableLocation(QStandardPaths::DesktopLocation));

SnapshotMetaData* Snapshot::parseSnapshotData(QString snapshotPath) {

    if (!QFile(snapshotPath).exists()) {
        return NULL;
    }

    QImage shot(snapshotPath);

    // no location data stored
    if (shot.text(URL).isEmpty()) {
        return NULL;
    }

    // parsing URL
    QUrl url = QUrl(shot.text(URL), QUrl::ParsingMode::StrictMode);

    SnapshotMetaData* data = new SnapshotMetaData();
    data->setURL(url);

    return data;
}

QString Snapshot::saveSnapshot(QImage image) {

    QFile* snapshotFile = savedFileForSnapshot(image, false);

    // we don't need the snapshot file, so close it, grab its filename and delete it
    snapshotFile->close();

    QString snapshotPath = QFileInfo(*snapshotFile).absoluteFilePath();

    delete snapshotFile;

    return snapshotPath;
}

QTemporaryFile* Snapshot::saveTempSnapshot(QImage image) {
    // return whatever we get back from saved file for snapshot
    return static_cast<QTemporaryFile*>(savedFileForSnapshot(image, true));
}

QFile* Snapshot::savedFileForSnapshot(QImage & shot, bool isTemporary) {

    // adding URL to snapshot
    QUrl currentURL = DependencyManager::get<AddressManager>()->currentAddress();
    shot.setText(URL, currentURL.toString());

    QString username = AccountManager::getInstance().getAccountInfo().getUsername();
    // normalize username, replace all non alphanumeric with '-'
    username.replace(QRegExp("[^A-Za-z0-9_]"), "-");

    QDateTime now = QDateTime::currentDateTime();

    QString filename = FILENAME_PATH_FORMAT.arg(username, now.toString(DATETIME_FORMAT));

    const int IMAGE_QUALITY = 100;

    if (!isTemporary) {
        QString snapshotFullPath = snapshotsLocation.get();

        if (!snapshotFullPath.endsWith(QDir::separator())) {
            snapshotFullPath.append(QDir::separator());
        }

        snapshotFullPath.append(filename);

        QFile* imageFile = new QFile(snapshotFullPath);
        imageFile->open(QIODevice::WriteOnly);

        shot.save(imageFile, 0, IMAGE_QUALITY);
        imageFile->close();

        return imageFile;

    } else {
        QTemporaryFile* imageTempFile = new QTemporaryFile(QDir::tempPath() + "/XXXXXX-" + filename);

        if (!imageTempFile->open()) {
            qDebug() << "Unable to open QTemporaryFile for temp snapshot. Will not save.";
            return NULL;
        }

        shot.save(imageTempFile, 0, IMAGE_QUALITY);
        imageTempFile->close();

        return imageTempFile;
    }
}

#include <QFile> // fixme
#include <QHttpMultiPart>
#include "InterfaceLogging.h"
#include "DependencyManager.h"
#include "AddressManager.h"


// Post the file and metadata to our server, and then bring up a page (from our server) that
// allows the user to ammend the text description and/or share on Facebook.
void Snapshot::post(QString fileName) {
    // It would be nice to just send all the info to the browser to upload, but browsers are
    // designed to not allow uploading without user intervention, and we don't want to bother the user with that.
    // So do the upload here. Note that:
    // 1. The browser display of the already uploaded data (with the sharing buttons) must be in a browser that
    //    allows Facebook login popups and retention of Facebook cookies.
    // 2. The file must be already uploaded before that browser display, because any sharing might cause Facebook
    //    to immediately scrape the corresponding server page, so the data had better already be there.

    DataServerAccountInfo& info = AccountManager::getInstance().getAccountInfo();
    auto addressManager = DependencyManager::get<AddressManager>();
    QByteArray username = info.getUsername().toUtf8();
    QString timeString = QString::number(QDateTime::currentMSecsSinceEpoch());
    QByteArray timeData = timeString.toUtf8();
    // IWBNI if every entity had a unique id (e.g., from marketplace) so that Likes can acrue regardless of context.
    // But for now, just separate entities without central/round-trip coordination by hashing username + timestring
    QCryptographicHash hasher(QCryptographicHash::Sha224); // When we do get unique ids, we'll want them to be this big to avoid masking attacks.
    hasher.addData(username);
    hasher.addData(timeData);
    QString id = hasher.result().toHex();  // hex rather than base64 to allow ids to be stored in a case-insensitive file system
    const QString base = "http://localhost:3000";

    // It's a shame that QT post is so awkward.
    QHttpMultiPart* multiPart = new QHttpMultiPart(QHttpMultiPart::FormDataType);

    QHttpPart submitter;
    submitter.setHeader(QNetworkRequest::ContentDispositionHeader, QVariant("form-data; name=\"submitter\""));
    submitter.setBody(username);
    multiPart->append(submitter);

    QHttpPart location;
    location.setHeader(QNetworkRequest::ContentDispositionHeader, QVariant("form-data; name=\"location\""));
    location.setBody(addressManager->currentAddress().toString().toUtf8());
    multiPart->append(location);

    QHttpPart timestamp;
    timestamp.setHeader(QNetworkRequest::ContentDispositionHeader, QVariant("form-data; name=\"timestamp\""));
    timestamp.setBody(timeString.toUtf8());
    multiPart->append(timestamp);

    QFile* file = new QFile(fileName);
    file->open(QIODevice::ReadOnly);
    QHttpPart imagePart;
    imagePart.setHeader(QNetworkRequest::ContentTypeHeader, QVariant("image/jpeg"));
    imagePart.setHeader(QNetworkRequest::ContentDispositionHeader,
                        QVariant("form-data; name=\"file\"; filename=\"" + file->fileName() +"\""));
    imagePart.setBodyDevice(file);
    file->setParent(multiPart); // we cannot delete the file now, so delete it with the multiPart
    multiPart->append(imagePart);
    
    const QUrl url(base + "/test/" + id);
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::UserAgentHeader, HIGH_FIDELITY_USER_AGENT);

    QNetworkReply* reply = NetworkAccessManager::getInstance().post(request, multiPart);
    QEventLoop loop;
    loop.connect(reply, &QNetworkReply::finished, [&]() {
        QVariant statusCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute);
        int status = statusCode.isValid() ? statusCode.toInt() : 500;
        if (status != 200) {
            qCWarning(interfaceapp) << "Snapshot upload failed:" <<
            reply->attribute(QNetworkRequest::HttpReasonPhraseAttribute).toString();  // our server gives a nice http status text.
        } else {
            qApp->openUrl(QUrl(base + "/share/" + id)); // Now that it's uploaded, give the user the opportunity to share/edit.
        }
        reply->deleteLater();
    });

    loop.connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    loop.exec();
}


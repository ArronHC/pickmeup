package com.pickmeup.assistant;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }
        )
    }
)
public class SmsReaderPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean readGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        boolean receiveGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        boolean granted = readGranted && receiveGranted;
        
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        boolean readGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        boolean receiveGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        if (readGranted && receiveGranted) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias("sms", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean readGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        boolean receiveGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        boolean granted = readGranted && receiveGranted;
        
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void getDeliverySms(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) 
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        int limit = call.getInt("limit", 50);
        long sinceTimestamp = call.getLong("sinceTimestamp", 0L);
        long sinceTime;
        if (sinceTimestamp > 0) {
            sinceTime = sinceTimestamp;
        } else {
            long sinceDays = call.getInt("sinceDays", 7);
            sinceTime = System.currentTimeMillis() - (sinceDays * 24 * 60 * 60 * 1000);
        }

        try {
            List<JSObject> messages = readSmsMessages(limit, sinceTime);
            JSObject result = new JSObject();
            result.put("messages", new JSArray(messages));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAllSms(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) 
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        int limit = call.getInt("limit", 100);

        try {
            List<JSObject> messages = readAllSmsMessages(limit);
            JSObject result = new JSObject();
            result.put("messages", new JSArray(messages));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAutoImportedPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("packages", SmsAutoImportStore.getPackages(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void clearAutoImportedPackages(PluginCall call) {
        JSArray idsArray = call.getArray("ids");
        List<String> ids = new ArrayList<>();
        if (idsArray != null) {
            for (int i = 0; i < idsArray.length(); i++) {
                String id = idsArray.optString(i, "");
                if (id != null && !id.isEmpty()) {
                    ids.add(id);
                }
            }
        }

        int cleared = SmsAutoImportStore.clearPackages(getContext(), ids);
        JSObject result = new JSObject();
        result.put("cleared", cleared);
        call.resolve(result);
    }

    private List<JSObject> readSmsMessages(int limit, long sinceTime) {
        List<JSObject> deliveryMessages = new ArrayList<>();
        ContentResolver contentResolver = getContext().getContentResolver();
        Uri uri = Uri.parse("content://sms/inbox");
        
        String selection = "date > ?";
        String[] selectionArgs = { String.valueOf(sinceTime) };
        String sortOrder = "date DESC";

        Cursor cursor = contentResolver.query(uri, null, selection, selectionArgs, sortOrder);

        if (cursor != null && cursor.moveToFirst()) {
            int idIndex = cursor.getColumnIndex("_id");
            int addressIndex = cursor.getColumnIndex("address");
            int bodyIndex = cursor.getColumnIndex("body");
            int dateIndex = cursor.getColumnIndex("date");
            int readIndex = cursor.getColumnIndex("read");

            int count = 0;
            do {
                String body = cursor.getString(bodyIndex);
                
                // 检查是否是快递相关短信
                if (SmsRecognitionUtils.isDeliveryRelated(body)) {
                    JSObject message = new JSObject();
                    message.put("id", cursor.getString(idIndex));
                    message.put("address", cursor.getString(addressIndex));
                    message.put("body", body);
                    message.put("date", cursor.getLong(dateIndex));
                    message.put("isRead", cursor.getInt(readIndex) == 1);
                    
                    deliveryMessages.add(message);
                    count++;
                }

                if (count >= limit) break;
            } while (cursor.moveToNext());

            cursor.close();
        }

        return deliveryMessages;
    }

    private List<JSObject> readAllSmsMessages(int limit) {
        List<JSObject> messages = new ArrayList<>();
        ContentResolver contentResolver = getContext().getContentResolver();
        Uri uri = Uri.parse("content://sms/inbox");
        
        String sortOrder = "date DESC LIMIT " + limit;

        Cursor cursor = contentResolver.query(uri, null, null, null, sortOrder);

        if (cursor != null && cursor.moveToFirst()) {
            int idIndex = cursor.getColumnIndex("_id");
            int addressIndex = cursor.getColumnIndex("address");
            int bodyIndex = cursor.getColumnIndex("body");
            int dateIndex = cursor.getColumnIndex("date");
            int readIndex = cursor.getColumnIndex("read");

            do {
                JSObject message = new JSObject();
                message.put("id", cursor.getString(idIndex));
                message.put("address", cursor.getString(addressIndex));
                message.put("body", cursor.getString(bodyIndex));
                message.put("date", cursor.getLong(dateIndex));
                message.put("isRead", cursor.getInt(readIndex) == 1);
                
                messages.add(message);
            } while (cursor.moveToNext());

            cursor.close();
        }

        return messages;
    }
}
